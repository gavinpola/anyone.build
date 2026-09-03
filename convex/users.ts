import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { authComponent, type AuthUserLike } from "./auth";

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
    const trust = isMaintainer ? 3 : Math.max(existing.trust, computeTrust(base));
    await ctx.db.patch(existing._id, { ...base, trust });
    return existing._id;
  }
  return await ctx.db.insert("users", {
    ...base,
    trust: isMaintainer ? 3 : computeTrust(base),
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

export const touch = mutation({
  args: {},
  handler: async (ctx) => {
    const u = await getViewerUser(ctx);
    if (u) await ctx.db.patch(u._id, { lastSeenAt: Date.now() });
  },
});
