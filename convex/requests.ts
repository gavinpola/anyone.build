import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getViewerUser, publicUser, requireUser } from "./users";
import { rateLimiter, submitLimitFor } from "./rateLimits";
import { getAllConfig } from "./config";
import { reserve } from "./budget";
import { findGuest, guestHandle, parseGuestId, resolveActor } from "./lib/guest";
import { HOUR } from "@convex-dev/rate-limiter";
import { requestStatus, rejectionCategory, scope as scopeV } from "./schema";
import { isAllowedPath } from "../packages/gatekeeper/src/validate/paths.js";
import { siteDay } from "./lib/days";

const ACTIVE = new Set(["judging", "needs_human", "queued", "building", "validating", "reviewing", "preview", "merging"]);

function normalizePrompt(p: string) {
  return p.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

type ViewerKey = { userId: Id<"users"> | null; guestId: string | null };

export function isMine(r: { userId?: Id<"users">; guestId?: string }, v: ViewerKey) {
  return Boolean((v.userId && r.userId === v.userId) || (v.guestId && r.guestId === v.guestId));
}

export async function toFeed(ctx: QueryCtx, r: Doc<"requests">, viewer: ViewerKey) {
  const u = r.userId ? await ctx.db.get(r.userId) : null;
  const g = !u && r.guestId ? await findGuest(ctx, r.guestId) : null;
  return {
    id: r._id,
    user: u ? { handle: u.handle, avatarUrl: u.avatarUrl ?? null, guest: false } : { handle: g ? guestHandle(g) : "guest", avatarUrl: null, guest: true },
    prompt: r.prompt,
    target: r.target,
    status: r.status,
    stage: r.stage,
    verdict: r.verdict
      ? { approved: r.verdict.approved, category: r.verdict.category, hint: r.verdict.hint, scope: r.verdict.scope }
      : undefined,
    run: r.run
      ? {
          previewUrl: r.run.previewUrl,
          prUrl: r.run.prUrl,
          summary: r.run.summary,
          linesAdded: r.run.linesAdded,
          linesRemoved: r.run.linesRemoved,
          costCents: r.run.costCents,
        }
      : undefined,
    plusOnes: r.plusOnes,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    pinnedUntil: r.pinnedUntil,
    mine: isMine(r, viewer),
  };
}

async function viewerKey(ctx: QueryCtx, guestId?: string | null): Promise<ViewerKey> {
  const u = await getViewerUser(ctx);
  return { userId: u?._id ?? null, guestId: parseGuestId(guestId) };
}

const PUBLIC_STATUSES = new Set(["queued", "building", "validating", "reviewing", "preview", "merging", "live"]);

/**
 * The public feed shows approved work only. Judging, rejections, and needs_human are visible
 * to their requester alone. Two queries so the frequently-changing in-flight list stays small.
 */
export const active = query({
  args: { roomId: v.optional(v.string()), guestId: v.optional(v.string()) },
  handler: async (ctx, { roomId, guestId }) => {
    const vk = await viewerKey(ctx, guestId);
    const rows = await ctx.db
      .query("requests")
      .withIndex("by_room", (q) => q.eq("roomId", roomId ?? "main"))
      .order("desc")
      .take(80);
    const keep = rows.filter((r) => r.status !== "live" && (PUBLIC_STATUSES.has(r.status) || isMine(r, vk)));
    return Promise.all(keep.slice(0, 30).map((r) => toFeed(ctx, r, vk)));
  },
});

export const landed = query({
  args: { roomId: v.optional(v.string()), limit: v.optional(v.number()), guestId: v.optional(v.string()) },
  handler: async (ctx, { roomId, limit, guestId }) => {
    const vk = await viewerKey(ctx, guestId);
    const rows = await ctx.db
      .query("requests")
      .withIndex("by_status", (q) => q.eq("status", "live"))
      .order("desc")
      .take(Math.min(limit ?? 30, 100));
    const keep = rows.filter((r) => r.roomId === (roomId ?? "main"));
    return Promise.all(keep.map((r) => toFeed(ctx, r, vk)));
  },
});

/** Where a queued request stands in line (small, cheap, only for the requester's card). */
export const queuePosition = query({
  args: { id: v.id("requests") },
  handler: async (ctx, { id }) => {
    const r = await ctx.db.get(id);
    if (!r || r.status !== "queued") return null;
    const ahead = await ctx.db.query("requests").withIndex("by_status", (q) => q.eq("status", "queued").lt("createdAt", r.createdAt)).take(200);
    return ahead.length + 1;
  },
});

export const get = query({
  args: { id: v.id("requests"), guestId: v.optional(v.string()) },
  handler: async (ctx, { id, guestId }) => {
    const r = await ctx.db.get(id);
    if (!r) return null;
    const vk = await viewerKey(ctx, guestId);
    const viewer = vk.userId ? await ctx.db.get(vk.userId) : null;
    // Non-public states are the requester's business (and maintainers').
    if (!PUBLIC_STATUSES.has(r.status) && !isMine(r, vk) && (viewer?.trust ?? 0) < 3) return null;
    return toFeed(ctx, r, vk);
  },
});

export const submit = mutation({
  args: {
    roomId: v.optional(v.string()),
    prompt: v.string(),
    target: v.object({
      path: v.string(),
      line: v.number(),
      blockId: v.optional(v.string()),
      blockTitle: v.optional(v.string()),
      tag: v.optional(v.string()),
      text: v.optional(v.string()),
    }),
    guestId: v.optional(v.string()),
    turnstileTicket: v.optional(v.string()),
  },
  handler: async (ctx, { roomId, prompt, target, guestId, turnstileTicket }) => {
    const c = await getAllConfig(ctx);
    const { user, guest } = await resolveActor(ctx, guestId, { create: !(await getViewerUser(ctx)) && c.guestsEnabled });
    if (user?.banned) throw new Error("This account can't submit changes.");
    if (!user && !guest) throw new Error(c.guestsEnabled ? "Couldn't identify this browser. Try reloading." : "Sign in with GitHub to change the wall.");
    if (guest?.banned) throw new Error("This browser can't submit changes.");
    // Bind an unbound guest row to the signed-in user (same person, right now).
    if (user && guest && !guest.userId) await ctx.db.patch(guest._id, { userId: user._id, claimedAt: Date.now() });
    const actorGuestId = guest && (!guest.userId || guest.userId === user?._id) ? guest.guestId : undefined;
    const roomKey = roomId ?? "main";
    const clean = prompt.replace(/\s+/g, " ").trim();
    if (clean.length < 8) throw new Error("Say a little more about what should change.");
    if (clean.length > 600) throw new Error("Keep it under 600 characters.");
    const isNewBlock = target.path === `src/rooms/${roomKey}/blocks/`;
    if (!isNewBlock && (!isAllowedPath(target.path) || !target.path.startsWith(`src/rooms/${roomKey}/`))) {
      throw new Error("You can only change things on the wall.");
    }

    const actorKey = user ? user._id : `g:${guest!.guestId}`;
    // Rate limits: a burst brake (anti-script), a global guest cap, and a very high daily ceiling.
    await rateLimiter.limit(ctx, "submitBurst", { key: actorKey, throws: true });
    if (!user) {
      if (turnstileTicket !== undefined || process.env.TURNSTILE_SECRET) {
        const ok = await consumeTicket(ctx, turnstileTicket, guest!.guestId);
        if (!ok && process.env.TURNSTILE_SECRET) throw new Error("Please complete the check and try again.");
      }
      const g = await rateLimiter.limit(ctx, "guestGlobal", { key: "global", config: { kind: "fixed window", rate: c.guestHourlyCap, period: HOUR } });
      if (!g.ok) throw new Error("The wall is busy with guests right now. Sign in, or try again in a bit.");
    }
    const daily = await rateLimiter.limit(ctx, user ? submitLimitFor(user.trust) : "submitGuest", { key: actorKey });
    if (!daily.ok) {
      const id = await insert(ctx, { user, guestId: actorGuestId }, roomKey, clean, target, 0);
      await ctx.db.patch(id, {
        status: "rejected",
        verdict: { approved: false, category: "slow_down", hint: "That's a lot of asks for one day from one place. Try again tomorrow.", scope: "tiny", confidence: 1, plan: [], redTeamed: false, model: "rate-limit" },
      });
      return id;
    }

    // Too many in flight for one person
    const inflight = user
      ? await ctx.db.query("requests").withIndex("by_user", (q) => q.eq("userId", user._id)).order("desc").take(10)
      : await ctx.db.query("requests").withIndex("by_guest", (q) => q.eq("guestId", guest!.guestId)).order("desc").take(10);
    // One build per person at a time (builds are the paid part, and one landing before the next keeps the
    // wall legible); the moment it lands, fails, or goes to a vote, they can ask again. Not a daily count.
    if (inflight.some((r) => ACTIVE.has(r.status))) {
      throw new Error("Your change is still building. When it lands, ask for the next one.");
    }

    // Same ask, same block, already approved and in flight within the last 20 minutes → +1 instead
    // of a second build. Only public in-flight states count: judging/needs_human must never swallow a new ask.
    const norm = normalizePrompt(clean);
    const recent = await ctx.db
      .query("requests")
      .withIndex("by_room", (q) => q.eq("roomId", roomKey))
      .order("desc")
      .take(40);
    const cutoff = Date.now() - 20 * 60 * 1000;
    const dup = recent.find(
      (r) =>
        r.createdAt > cutoff &&
        ["queued", "building", "validating", "reviewing", "preview", "merging"].includes(r.status) &&
        (r.target.blockId ?? null) === (target.blockId ?? null) &&
        r.target.path === target.path &&
        normalizePrompt(r.prompt) === norm &&
        !isMine(r, { userId: user?._id ?? null, guestId: actorGuestId ?? null }),
    );
    if (dup) {
      await ctx.db.patch(dup._id, { plusOnes: dup.plusOnes + 1, updatedAt: Date.now() });
      return dup._id;
    }

    const id = await insert(ctx, { user, guestId: actorGuestId }, roomKey, clean, target, 0);
    if (guest) await ctx.db.patch(guest._id, { requests: guest.requests + 1, lastSeenAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.pipeline.judge.run, { requestId: id });
    return id;
  },
});

/** Turnstile ticket: single use, must match the guest, must be fresh. */
async function consumeTicket(ctx: Parameters<typeof reserve>[0], ticket: string | undefined, guestId: string): Promise<boolean> {
  if (!ticket) return false;
  const t = await ctx.db.query("guestTickets").withIndex("by_ticket", (q) => q.eq("ticket", ticket)).unique();
  if (!t || t.used || t.guestId !== guestId || t.expiresAt < Date.now()) return false;
  await ctx.db.patch(t._id, { used: true });
  return true;
}

async function insert(
  ctx: Parameters<typeof reserve>[0],
  actor: { user: Doc<"users"> | null; guestId?: string },
  roomId: string,
  prompt: string,
  target: Doc<"requests">["target"] & { blockTitle?: string },
  budgetCents: number,
) {
  const now = Date.now();
  const { blockTitle: _bt, ...t } = target;
  const id = await ctx.db.insert("requests", {
    userId: actor.user?._id,
    guestId: actor.guestId,
    roomId,
    prompt,
    target: t,
    status: "judging",
    budgetCents,
    plusOnes: 0,
    createdAt: now,
    updatedAt: now,
  });
  await ctx.runMutation(internal.stats.bump, { requests: 1 });
  return id;
}

export const cancel = mutation({
  args: { id: v.id("requests"), guestId: v.optional(v.string()) },
  handler: async (ctx, { id, guestId }) => {
    const vk = await viewerKey(ctx, guestId);
    const user = vk.userId ? await ctx.db.get(vk.userId) : null;
    const r = await ctx.db.get(id);
    if (!r) return;
    if (!isMine(r, vk) && (user?.trust ?? 0) < 3) throw new Error("Not yours");
    if (!ACTIVE.has(r.status) || r.status === "merging") return;
    await ctx.db.patch(id, { status: "cancelled", stage: undefined, updatedAt: Date.now() });
    if (r.budgetCents > 0) await ctx.runMutation(internal.requests.settleOnce, { id, spentCents: r.run?.costCents ?? 0 });
    await ctx.runMutation(internal.pipeline.executor.release, { requestId: id });
  },
});

export const plusOne = mutation({
  args: { id: v.id("requests"), guestId: v.optional(v.string()) },
  handler: async (ctx, { id, guestId }) => {
    const vk = await viewerKey(ctx, guestId);
    if (!vk.userId && !vk.guestId) return;
    await rateLimiter.limit(ctx, vk.userId ? "storeWrite" : "guestPlusOne", { key: `plus:${vk.userId ?? vk.guestId}`, throws: true });
    const r = await ctx.db.get(id);
    if (!r || !ACTIVE.has(r.status)) return;
    await ctx.db.patch(id, { plusOnes: r.plusOnes + 1 });
  },
});

/** Internal: pipeline state transitions. */
const TERMINAL = new Set(["live", "rejected", "failed", "cancelled"]);

/**
 * Pipeline state transition. Terminal states are sticky: a request cancelled during a build
 * stays cancelled, and the build notices (`ok: false`) and stops.
 */
export const setStatus = internalMutation({
  args: {
    id: v.id("requests"),
    status: requestStatus,
    stage: v.optional(v.string()),
    run: v.optional(v.any()),
    pinSeconds: v.optional(v.number()),
  },
  handler: async (ctx, { id, status, stage, run, pinSeconds }) => {
    const r = await ctx.db.get(id);
    if (!r) return { ok: false as const };
    if (TERMINAL.has(r.status) && r.status !== status) return { ok: false as const, status: r.status };
    await ctx.db.patch(id, {
      status,
      stage,
      run: run ? { ...(r.run ?? {}), ...run } : r.run,
      pinnedUntil: pinSeconds ? Date.now() + pinSeconds * 1000 : r.pinnedUntil,
      updatedAt: Date.now(),
    });
    return { ok: true as const };
  },
});

/** Compare-and-set: preview → merging. Exactly one caller wins. */
export const beginMerge = internalMutation({
  args: { id: v.id("requests") },
  handler: async (ctx, { id }) => {
    const r = await ctx.db.get(id);
    if (!r || r.status !== "preview") return false;
    await ctx.db.patch(id, { status: "merging", stage: "merging", updatedAt: Date.now() });
    return true;
  },
});

/** Settle a request's budget exactly once. */
export const settleOnce = internalMutation({
  args: { id: v.id("requests"), spentCents: v.number() },
  handler: async (ctx, { id, spentCents }) => {
    const r = await ctx.db.get(id);
    if (!r || r.settled) return;
    await ctx.db.patch(id, { settled: true });
    await ctx.runMutation(internal.budget.settle, { day: r.budgetDay ?? siteDay(r.createdAt), reservedCents: r.budgetCents, spentCents });
  },
});

export const setVerdict = internalMutation({
  args: {
    touchesBackend: v.optional(v.boolean()),
    id: v.id("requests"),
    approved: v.boolean(),
    needsHuman: v.boolean(),
    category: v.optional(rejectionCategory),
    hint: v.string(),
    scope: scopeV,
    confidence: v.number(),
    plan: v.array(v.string()),
    redTeamed: v.boolean(),
    model: v.string(),
    capCents: v.number(),
    judgeCents: v.optional(v.number()),
  },
  handler: async (ctx, a) => {
    const r = await ctx.db.get(a.id);
    if (!r || r.status !== "judging") return { ok: false, reason: "not judging" };
    // Judging costs money even when the answer is no; it comes out of the day's budget as spend.
    if (a.judgeCents && a.judgeCents > 0) await ctx.runMutation(internal.budget.settle, { day: siteDay(), reservedCents: 0, spentCents: a.judgeCents });
    const verdict = { approved: a.approved, category: a.category, hint: a.hint, scope: a.scope, confidence: a.confidence, plan: a.plan, redTeamed: a.redTeamed, model: a.model, touchesBackend: a.touchesBackend };
    if (!a.approved) {
      // Safe and for-everyone, but bigger than this requester can auto-ship? It's not a no — it goes up
      // for a vote. Anyone can propose, guests included: a proposal is just a row; only signed-in people
      // can vote, and nothing builds without votes, so junk can't self-build.
      const propose = a.category === "too_big";
      if (propose) {
        await ctx.db.patch(a.id, { status: "proposed", verdict, proposalVotes: 0, updatedAt: Date.now() });
        return { ok: true, queued: false, proposed: true };
      }
      await ctx.db.patch(a.id, { status: "rejected", verdict, updatedAt: Date.now() });
      return { ok: true, queued: false };
    }
    const hourly = await rateLimiter.limit(ctx, "approvalsGlobal", { key: "global" });
    if (!hourly.ok) {
      await ctx.db.patch(a.id, { status: "rejected", verdict: { ...verdict, approved: false, category: "slow_down", hint: "The wall is busy. Try again in a bit." }, updatedAt: Date.now() });
      return { ok: true, queued: false };
    }
    // Backpressure: past 60 in line, say so instead of growing a queue nobody will wait for.
    const inLine = await ctx.db.query("requests").withIndex("by_status", (q) => q.eq("status", "queued")).take(61);
    if (inLine.length >= 60) {
      await ctx.db.patch(a.id, { status: "rejected", verdict: { ...verdict, approved: false, category: "slow_down", hint: "The wall is busy right now: sixty changes are in line. Ask again in a few minutes." }, updatedAt: Date.now() });
      return { ok: true, queued: false };
    }
    const reserved = await reserve(ctx, a.capCents);
    if (!reserved) {
      await ctx.db.patch(a.id, { status: "rejected", verdict: { ...verdict, approved: false, category: "budget_spent", hint: "Today's budget is spent. Patrons top it up, or it resets at midnight ET." }, updatedAt: Date.now() });
      return { ok: true, queued: false };
    }
    const c = await getAllConfig(ctx);
    await ctx.db.patch(a.id, { status: "queued", verdict, budgetCents: a.capCents, budgetDay: siteDay(), pinnedUntil: Date.now() + c.pinSeconds * 1000, updatedAt: Date.now() });
    return { ok: true, queued: true };
  },
});

export const getInternal = internalQuery({
  args: { id: v.id("requests") },
  handler: async (ctx, { id }) => {
    const r = await ctx.db.get(id);
    if (!r) return null;
    const u = r.userId ? await ctx.db.get(r.userId) : null;
    const g = !u && r.guestId ? await findGuest(ctx, r.guestId) : null;
    return { request: r, user: u ? publicUser(u) : null, guest: g ? { tag: g.tag, handle: guestHandle(g) } : null };
  },
});

export const recentChanges = internalQuery({
  args: { roomId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { roomId, limit }) => {
    const rows = await ctx.db.query("changes").withIndex("by_mergedAt").order("desc").take(limit ?? 20);
    const out = [];
    for (const c of rows) {
      if (c.roomId !== roomId || c.revertedAt) continue;
      const u = c.userId ? await ctx.db.get(c.userId) : null;
      out.push({ summary: c.summary, by: u?.handle ?? "a guest", blockIds: c.blockIds });
    }
    return out;
  },
});

/** Judge a stuck proposal again (after a judge fix), same requester, same ask. Internal (CLI) only. Votes already cast stay on record. */
export const rejudge = internalMutation({
  args: { id: v.id("requests") },
  handler: async (ctx, { id }) => {
    const r = await ctx.db.get(id);
    if (!r || !["proposed", "rejected"].includes(r.status)) throw new Error("Not a proposed or rejected request");
    await ctx.db.patch(id, { status: "judging", verdict: undefined, stage: undefined, proposalVotes: 0, updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.pipeline.judge.run, { requestId: id });
  },
});

/** Re-run a failed build under the same request: same requester, same verdict, a fresh budget reservation. Internal (CLI) only. */
export const rebuildFailed = internalMutation({
  args: { id: v.id("requests") },
  handler: async (ctx, { id }) => {
    const r = await ctx.db.get(id);
    if (!r || r.status !== "failed" || !r.verdict) throw new Error("Not a failed request with a verdict");
    const c = await getAllConfig(ctx);
    const cap = c.scopeCapsCents[r.verdict.scope];
    const reserved = await reserve(ctx, cap);
    if (!reserved) throw new Error("No budget left today");
    await ctx.db.patch(id, {
      status: "queued",
      stage: undefined,
      settled: false,
      run: undefined,
      verdict: { ...r.verdict, approved: true, category: undefined, hint: "Approved. Building now." },
      budgetCents: cap,
      budgetDay: siteDay(),
      updatedAt: Date.now(),
    });
    await ctx.runMutation(internal.pipeline.executor.enqueue, { requestId: id });
  },
});

/** Maintainer decision on a needs_human request. */
export const decide = mutation({
  args: { id: v.id("requests"), approve: v.boolean(), note: v.optional(v.string()) },
  handler: async (ctx, { id, approve, note }) => {
    const user = await requireUser(ctx);
    if (user.trust < 3) throw new Error("Maintainers only");
    const r = await ctx.db.get(id);
    if (!r || r.status !== "needs_human" || !r.verdict) return;
    if (!approve) {
      await ctx.db.patch(id, { status: "rejected", verdict: { ...r.verdict, approved: false, category: r.verdict.category ?? "not_for_everyone", hint: note ?? "A maintainer decided this one doesn't fit the wall." }, updatedAt: Date.now() });
      return;
    }
    const c = await getAllConfig(ctx);
    const cap = c.scopeCapsCents[r.verdict.scope];
    const reserved = await reserve(ctx, cap);
    if (!reserved) throw new Error("No budget left today");
    await ctx.db.patch(id, { status: "queued", verdict: { ...r.verdict, approved: true }, budgetCents: cap, budgetDay: siteDay(), updatedAt: Date.now() });
    await ctx.runMutation(internal.pipeline.executor.enqueue, { requestId: id });
  },
});
