import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { authComponent, type AuthUserLike } from "./auth";
import { findGuest, makeGuestTag, parseGuestId } from "./lib/guest";
import { claimGuestRows } from "./lib/claim";
import { rateLimiter } from "./rateLimits";

const THIRTY_DAYS = 30 * 24 * 3600 * 1000;

export function computeTrust(u: { githubCreatedAt?: number | null; publicRepos?: number | null }): number {
  const age = u.githubCreatedAt ? Date.now() - u.githubCreatedAt : 0;
  if (!u.githubCreatedAt || age < THIRTY_DAYS || (u.publicRepos ?? 0) === 0) return 0;
  return 1;
}

function maintainerHandles(): Set<string> {
  return new Set(
    (process.env.MAINTAINER_HANDLES ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Keep our `users` row in sync with Better Auth's user. Called from auth triggers. */
export async function mirrorAuthUser(ctx: MutationCtx, authUser: AuthUserLike) {
  const existing = await ctx.db
    .query("users")
    .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
    .unique();
  const handle = (authUser.handle ?? (authUser.name && authUser.name !== "Anonymous" ? authUser.name : null) ?? `anon-${authUser._id.slice(-6)}`)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");
  const isMaintainer = maintainerHandles().has(handle);
  // Dev-only anonymous sign-ins stand in for real GitHub accounts: treat them as builders.
  const devAnon = process.env.DEV_ANON_AUTH === "1" && authUser.name === "Anonymous";
  const base = {
    authId: authUser._id,
    githubId: authUser.githubId ?? undefined,
    handle,
    name: authUser.name ?? undefined,
    avatarUrl: authUser.image ?? undefined,
    githubCreatedAt: authUser.githubCreatedAt ?? undefined,
    publicRepos: authUser.publicRepos ?? undefined,
    followers: authUser.followers ?? undefined,
    lastSeenAt: Date.now(),
  };
  if (existing) {
    // Never undo a strike demotion on a profile refresh.
    const trust = isMaintainer ? 3 : existing.strikes >= 3 ? 0 : Math.max(existing.trust, devAnon ? 1 : computeTrust(base));
    await ctx.db.patch(existing._id, { ...base, trust });
    return existing._id;
  }
  return await ctx.db.insert("users", {
    ...base,
    trust: isMaintainer ? 3 : devAnon ? 1 : computeTrust(base),
    strikes: 0,
    liveChanges: 0,
    linesChanged: 0,
    reverted: 0,
    createdAt: Date.now(),
  });
}

export async function getViewerUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users"> | null> {
  const authUser = await authComponent.safeGetAuthUser(ctx);
  if (!authUser) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
    .unique();
}

export async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const user = await getViewerUser(ctx);
  if (!user) throw new Error("Sign in with GitHub first.");
  if (user.banned) throw new Error("This account can't submit changes.");
  return user;
}

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const user = await getViewerUser(ctx);
    if (!user) return null;
    return publicUser(user);
  },
});

export function publicUser(u: Doc<"users">) {
  return {
    id: u._id,
    handle: u.handle,
    name: u.name ?? null,
    avatarUrl: u.avatarUrl ?? null,
    trust: u.trust,
    liveChanges: u.liveChanges,
    linesChanged: u.linesChanged,
    reverted: u.reverted,
    createdAt: u.createdAt,
  };
}

export const byHandle = query({
  args: { handle: v.string() },
  handler: async (ctx, { handle }) => {
    const u = await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", handle.toLowerCase()))
      .unique();
    return u ? publicUser(u) : null;
  },
});

export const adjustStats = internalMutation({
  args: {
    userId: v.id("users"),
    liveChanges: v.optional(v.number()),
    linesChanged: v.optional(v.number()),
    reverted: v.optional(v.number()),
    strikes: v.optional(v.number()),
  },
  handler: async (ctx, { userId, ...delta }) => {
    const u = await ctx.db.get(userId);
    if (!u) return;
    const next = {
      liveChanges: u.liveChanges + (delta.liveChanges ?? 0),
      linesChanged: u.linesChanged + (delta.linesChanged ?? 0),
      reverted: u.reverted + (delta.reverted ?? 0),
      strikes: u.strikes + (delta.strikes ?? 0),
    };
    let trust = u.trust;
    if (trust < 3) {
      if (next.strikes >= 3) trust = 0;
      else if (next.liveChanges >= 5 && next.reverted <= 1) trust = Math.max(trust, 2);
    }
    await ctx.db.patch(userId, { ...next, trust });
  },
});

export type PublicUser = ReturnType<typeof publicUser>;
export type UserId = Id<"users">;

/** How much this browser did as a guest that isn't credited to anyone yet. */
export const claimable = query({
  args: { guestId: v.optional(v.string()) },
  handler: async (ctx, { guestId }) => {
    const user = await getViewerUser(ctx);
    const gid = parseGuestId(guestId);
    if (!user || !gid) return null;
    const guest = await findGuest(ctx, gid);
    if (!guest) return null;
    if (guest.userId && guest.userId !== user._id) return { requests: 0, changes: 0, claimedByOther: true };
    const reqs = await ctx.db.query("requests").withIndex("by_guest", (q) => q.eq("guestId", gid)).take(500);
    const chs = await ctx.db.query("changes").withIndex("by_guest", (q) => q.eq("guestId", gid)).take(500);
    return { requests: reqs.filter((r) => !r.userId).length, changes: chs.filter((c) => !c.userId).length, claimedByOther: false };
  },
});

/** Bind this browser's guest id to me and credit its changes. */
export const claim = mutation({
  args: { guestId: v.string() },
  handler: async (ctx, { guestId }) => {
    const user = await requireUser(ctx);
    const gid = parseGuestId(guestId);
    if (!gid) throw new Error("Bad guest id");
    await rateLimiter.limit(ctx, "claim", { key: user._id, throws: true });
    let guest = await findGuest(ctx, gid);
    if (!guest) {
      const id = await ctx.db.insert("guests", { guestId: gid, tag: makeGuestTag(), userId: user._id, claimedAt: Date.now(), requests: 0, createdAt: Date.now(), lastSeenAt: Date.now() });
      guest = (await ctx.db.get(id))!;
    }
    return await claimGuestRows(ctx, user, guest);
  },
});

export const touch = mutation({
  args: {},
  handler: async (ctx) => {
    const u = await getViewerUser(ctx);
    if (u) await ctx.db.patch(u._id, { lastSeenAt: Date.now() });
  },
});
