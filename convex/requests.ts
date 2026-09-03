import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getViewerUser, publicUser, requireUser } from "./users";
import { rateLimiter, submitLimitFor } from "./rateLimits";
import { getAllConfig } from "./config";
import { reserve } from "./budget";
import { requestStatus, rejectionCategory, scope as scopeV } from "./schema";
import { isAllowedPath } from "../packages/gatekeeper/src/validate/paths.js";
import { siteDay } from "./lib/days";

const ACTIVE = new Set(["judging", "needs_human", "queued", "building", "validating", "reviewing", "preview", "merging"]);

function normalizePrompt(p: string) {
  return p.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

export async function toFeed(ctx: QueryCtx, r: Doc<"requests">, viewerId: Id<"users"> | null) {
  const u = await ctx.db.get(r.userId);
  return {
    id: r._id,
    user: { handle: u?.handle ?? "someone", avatarUrl: u?.avatarUrl ?? null },
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
    mine: viewerId ? r.userId === viewerId : false,
  };
}

const PUBLIC_STATUSES = new Set(["queued", "building", "validating", "reviewing", "preview", "merging", "live"]);

/**
 * The public feed shows approved work only. Judging, rejections, and needs_human are visible
 * to their requester alone. Two queries so the frequently-changing in-flight list stays small.
 */
export const active = query({
  args: { roomId: v.optional(v.string()) },
  handler: async (ctx, { roomId }) => {
    const viewer = await getViewerUser(ctx);
    const rows = await ctx.db
      .query("requests")
      .withIndex("by_room", (q) => q.eq("roomId", roomId ?? "main"))
      .order("desc")
      .take(80);
    const mine = viewer?._id ?? null;
    const keep = rows.filter((r) => (r.status !== "live" && PUBLIC_STATUSES.has(r.status)) || (mine && r.userId === mine && r.status !== "live"));
    return Promise.all(keep.slice(0, 30).map((r) => toFeed(ctx, r, mine)));
  },
});

export const landed = query({
  args: { roomId: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { roomId, limit }) => {
    const viewer = await getViewerUser(ctx);
    const rows = await ctx.db
      .query("requests")
      .withIndex("by_status", (q) => q.eq("status", "live"))
      .order("desc")
      .take(Math.min(limit ?? 30, 100));
    const keep = rows.filter((r) => r.roomId === (roomId ?? "main"));
    return Promise.all(keep.map((r) => toFeed(ctx, r, viewer?._id ?? null)));
  },
});

/** Where a queued request stands in line (small, cheap, only for the requester's card). */
export const queuePosition = query({
  args: { id: v.id("requests") },
  handler: async (ctx, { id }) => {
    const r = await ctx.db.get(id);
    if (!r || r.status !== "queued") return null;
    const ahead = await ctx.db.query("requests").withIndex("by_status", (q) => q.eq("status", "queued").lt("createdAt", r.createdAt)).collect();
    return ahead.length + 1;
  },
});

export const get = query({
  args: { id: v.id("requests") },
  handler: async (ctx, { id }) => {
    const r = await ctx.db.get(id);
    if (!r) return null;
    const viewer = await getViewerUser(ctx);
    return toFeed(ctx, r, viewer?._id ?? null);
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
  },
  handler: async (ctx, { roomId, prompt, target }) => {
    const user = await requireUser(ctx);
    const roomKey = roomId ?? "main";
    const clean = prompt.replace(/\s+/g, " ").trim();
    if (clean.length < 8) throw new Error("Say a little more about what should change.");
    if (clean.length > 600) throw new Error("Keep it under 600 characters.");
    const isNewBlock = target.path === `src/rooms/${roomKey}/blocks/`;
    if (!isNewBlock && (!isAllowedPath(target.path) || !target.path.startsWith(`src/rooms/${roomKey}/`))) {
      throw new Error("You can only change things on the wall.");
    }

    // Rate limits: burst, then per-trust daily
    await rateLimiter.limit(ctx, "submitBurst", { key: user._id, throws: true });
    const daily = await rateLimiter.limit(ctx, submitLimitFor(user.trust), { key: user._id });
    if (!daily.ok) {
      const id = await insert(ctx, user, roomKey, clean, target, 0);
      await ctx.db.patch(id, {
        status: "rejected",
        verdict: { approved: false, category: "slow_down", hint: "You've hit your limit for today. Back at midnight ET.", scope: "tiny", confidence: 1, plan: [], redTeamed: false, model: "rate-limit" },
      });
      return id;
    }

    // Too many in flight for one person
    const inflight = await ctx.db
      .query("requests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(10);
    if (inflight.filter((r) => ACTIVE.has(r.status)).length >= (user.trust >= 2 ? 3 : 2)) {
      throw new Error("Let your current change land first.");
    }

    // Near-duplicate of a pending request on the same block → +1 instead
    const norm = normalizePrompt(clean);
    const recent = await ctx.db
      .query("requests")
      .withIndex("by_room", (q) => q.eq("roomId", roomKey))
      .order("desc")
      .take(40);
    const dup = recent.find(
      (r) => ACTIVE.has(r.status) && r.target.blockId === target.blockId && normalizePrompt(r.prompt) === norm,
    );
    if (dup) {
      await ctx.db.patch(dup._id, { plusOnes: dup.plusOnes + 1, updatedAt: Date.now() });
      return dup._id;
    }

    const id = await insert(ctx, user, roomKey, clean, target, 0);
    await ctx.scheduler.runAfter(0, internal.pipeline.judge.run, { requestId: id });
    return id;
  },
});

async function insert(
  ctx: Parameters<typeof reserve>[0],
  user: Doc<"users">,
  roomId: string,
  prompt: string,
  target: Doc<"requests">["target"] & { blockTitle?: string },
  budgetCents: number,
) {
  const now = Date.now();
  const { blockTitle: _bt, ...t } = target;
  const id = await ctx.db.insert("requests", {
    userId: user._id,
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
  args: { id: v.id("requests") },
  handler: async (ctx, { id }) => {
    const user = await requireUser(ctx);
    const r = await ctx.db.get(id);
    if (!r) return;
    if (r.userId !== user._id && user.trust < 3) throw new Error("Not yours");
    if (!ACTIVE.has(r.status) || r.status === "merging") return;
    await ctx.db.patch(id, { status: "cancelled", stage: undefined, updatedAt: Date.now() });
    if (r.budgetCents > 0) await ctx.runMutation(internal.budget.settle, { day: siteDay(r.createdAt), reservedCents: r.budgetCents, spentCents: r.run?.costCents ?? 0 });
  },
});

export const plusOne = mutation({
  args: { id: v.id("requests") },
  handler: async (ctx, { id }) => {
    await requireUser(ctx);
    const r = await ctx.db.get(id);
    if (!r || !ACTIVE.has(r.status)) return;
    await ctx.db.patch(id, { plusOnes: r.plusOnes + 1 });
  },
});

/** Internal: pipeline state transitions. */
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
    if (!r) return;
    await ctx.db.patch(id, {
      status,
      stage,
      run: run ? { ...(r.run ?? {}), ...run } : r.run,
      pinnedUntil: pinSeconds ? Date.now() + pinSeconds * 1000 : r.pinnedUntil,
      updatedAt: Date.now(),
    });
  },
});

export const setVerdict = internalMutation({
  args: {
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
  },
  handler: async (ctx, a) => {
    const r = await ctx.db.get(a.id);
    if (!r || r.status !== "judging") return { ok: false, reason: "not judging" };
    const verdict = { approved: a.approved, category: a.category, hint: a.hint, scope: a.scope, confidence: a.confidence, plan: a.plan, redTeamed: a.redTeamed, model: a.model };
    if (!a.approved) {
      await ctx.db.patch(a.id, { status: a.needsHuman ? "needs_human" : "rejected", verdict, updatedAt: Date.now() });
      return { ok: true, queued: false };
    }
    const hourly = await rateLimiter.limit(ctx, "approvalsGlobal", { key: "global" });
    if (!hourly.ok) {
      await ctx.db.patch(a.id, { status: "rejected", verdict: { ...verdict, approved: false, category: "slow_down", hint: "The wall is busy. Try again in a bit." }, updatedAt: Date.now() });
      return { ok: true, queued: false };
    }
    const reserved = await reserve(ctx, a.capCents);
    if (!reserved) {
      await ctx.db.patch(a.id, { status: "rejected", verdict: { ...verdict, approved: false, category: "budget_spent", hint: "Today's budget is spent. Patrons top it up, or it resets at midnight ET." }, updatedAt: Date.now() });
      return { ok: true, queued: false };
    }
    const c = await getAllConfig(ctx);
    await ctx.db.patch(a.id, { status: "queued", verdict, budgetCents: a.capCents, pinnedUntil: Date.now() + c.pinSeconds * 1000, updatedAt: Date.now() });
    return { ok: true, queued: true };
  },
});

export const getInternal = internalQuery({
  args: { id: v.id("requests") },
  handler: async (ctx, { id }) => {
    const r = await ctx.db.get(id);
    if (!r) return null;
    const u = await ctx.db.get(r.userId);
    return { request: r, user: u ? publicUser(u) : null };
  },
});

export const recentChanges = internalQuery({
  args: { roomId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { roomId, limit }) => {
    const rows = await ctx.db.query("changes").withIndex("by_mergedAt").order("desc").take(limit ?? 20);
    const out = [];
    for (const c of rows) {
      if (c.roomId !== roomId || c.revertedAt) continue;
      const u = await ctx.db.get(c.userId);
      out.push({ summary: c.summary, by: u?.handle ?? "someone", blockIds: c.blockIds });
    }
    return out;
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
    await ctx.db.patch(id, { status: "queued", verdict: { ...r.verdict, approved: true }, budgetCents: cap, updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.pipeline.executor.start, { requestId: id });
  },
});
