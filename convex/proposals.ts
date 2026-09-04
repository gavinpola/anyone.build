import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { getViewerUser, requireUser } from "./users";
import { rateLimiter } from "./rateLimits";
import { getAllConfig } from "./config";
import { reserve } from "./budget";
import { siteDay } from "./lib/days";

const MIN_VOTES_TO_BUILD = 1;

/** The board: safe-but-big asks people can vote on. Newest-and-most-wanted first. */
/** Who asked, as the board shows it: a handle that links to GitHub for people who signed in there; guests stay guests. */
export function whoAsked(u: { handle: string; avatarUrl?: string | null } | null): { handle: string; github: string | null; avatarUrl: string | null; guest: boolean } {
  if (!u) return { handle: "a guest", github: null, avatarUrl: null, guest: true };
  const fromGithub = /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/i.test(u.handle) && !u.handle.startsWith("anon-");
  return { handle: u.handle, github: fromGithub ? `https://github.com/${u.handle}` : null, avatarUrl: u.avatarUrl ?? null, guest: false };
}

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const viewer = await getViewerUser(ctx);
    const rows = await ctx.db
      .query("requests")
      .withIndex("by_status", (q) => q.eq("status", "proposed"))
      .order("desc")
      .take(Math.min(limit ?? 40, 100));
    const out = [];
    for (const r of rows) {
      const mine = viewer ? await ctx.db.query("proposalVotes").withIndex("by_request_user", (q) => q.eq("requestId", r._id).eq("userId", viewer._id)).unique() : null;
      const u = r.userId ? await ctx.db.get(r.userId) : null;
      out.push({
        id: r._id,
        by: whoAsked(u),
        prompt: r.prompt,
        scope: r.verdict?.scope ?? "large",
        hint: r.verdict?.hint ?? "",
        votes: r.proposalVotes ?? 0,
        myVote: Boolean(mine),
        createdAt: r.createdAt,
      });
    }
    // most-voted first, then newest
    out.sort((a, b) => b.votes - a.votes || b.createdAt - a.createdAt);
    return out;
  },
});

/** Toggle a vote on a proposal. Signed-in only; one per person. You may vote for your own idea. */
export const vote = mutation({
  args: { requestId: v.id("requests") },
  handler: async (ctx, { requestId }) => {
    const user = await requireUser(ctx);
    await rateLimiter.limit(ctx, "storeWrite", { key: `pvote:${user._id}`, throws: true });
    const r = await ctx.db.get(requestId);
    if (!r || r.status !== "proposed") return { voted: false, votes: r?.proposalVotes ?? 0 };
    const existing = await ctx.db
      .query("proposalVotes")
      .withIndex("by_request_user", (q) => q.eq("requestId", requestId).eq("userId", user._id))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      const votes = Math.max(0, (r.proposalVotes ?? 0) - 1);
      await ctx.db.patch(requestId, { proposalVotes: votes });
      return { voted: false, votes };
    }
    await ctx.db.insert("proposalVotes", { requestId, userId: user._id, createdAt: Date.now() });
    const votes = (r.proposalVotes ?? 0) + 1;
    await ctx.db.patch(requestId, { proposalVotes: votes });
    return { voted: true, votes };
  },
});

/**
 * Promote the top-voted proposal into the normal pipeline, once per run. The build is gated exactly
 * like any other change (validator, diff review, security pass), so a winning-but-unsafe idea still
 * fails at build. Rationing to one per round keeps big builds affordable no matter how many are proposed.
 * A round is three hours (convex/lib/rounds.ts); at its end the winner is built and every other proposal
 * expires, so each round starts from a clean board.
 */
export const promoteTop = internalMutation({
  args: {},
  handler: async (ctx) => {
    const proposed = await ctx.db
      .query("requests")
      .withIndex("by_status_votes", (q) => q.eq("status", "proposed"))
      .order("desc")
      .take(1);
    const top = proposed[0];
    if (!top || (top.proposalVotes ?? 0) < MIN_VOTES_TO_BUILD || !top.verdict) {
      const expired = await expireRound(ctx, "The round ended without votes, so the board started over. Ask again if you still want it.");
      return { promoted: false, expired };
    }

    const config = await getAllConfig(ctx);
    const capCents = config.scopeCapsCents[top.verdict.scope];
    const reserved = await reserve(ctx, capCents);
    if (!reserved) return { promoted: false, reason: "budget" };

    // Clone into a fresh queued request so the proposal row stays as the historical record.
    const now = Date.now();
    const cloneId = await ctx.db.insert("requests", {
      userId: top.userId,
      guestId: top.guestId,
      roomId: top.roomId,
      prompt: top.prompt,
      target: top.target,
      status: "queued",
      verdict: top.verdict,
      budgetCents: capCents,
      budgetDay: siteDay(),
      settled: false,
      plusOnes: 0,
      promotedFrom: top._id,
      pinnedUntil: now + config.pinSeconds * 1000,
      createdAt: now,
      updatedAt: now,
    });
    // The proposal itself is retired from the board (its clone now carries the build).
    await ctx.db.patch(top._id, { status: "rejected", verdict: { ...top.verdict, hint: "This won the vote and is being built now." }, updatedAt: now });
    await ctx.runMutation(internal.pipeline.executor.enqueue, { requestId: cloneId });
    // The round is over: everything else on the board expires, and the next round starts clean.
    const expired = await expireRound(ctx, "The round ended: the most-wanted ask was built and the board started over. Ask again if you still want it.");
    return { promoted: true, requestId: cloneId, votes: top.proposalVotes ?? 0, expired };
  },
});

/** Every other proposal leaves the board at the end of a round; re-asking is one click. */
async function expireRound(ctx: MutationCtx, hint: string): Promise<number> {
  const rows = await ctx.db.query("requests").withIndex("by_status", (q) => q.eq("status", "proposed")).take(200);
  const now = Date.now();
  for (const r of rows) {
    await ctx.db.patch(r._id, { status: "rejected", verdict: r.verdict ? { ...r.verdict, hint } : undefined, updatedAt: now });
  }
  return rows.length;
}

/** How many proposals are open, for the section header. */
export const count = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("requests").withIndex("by_status", (q) => q.eq("status", "proposed")).take(100);
    return rows.length;
  },
});
