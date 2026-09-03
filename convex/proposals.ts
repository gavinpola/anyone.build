import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getViewerUser, requireUser } from "./users";
import { rateLimiter } from "./rateLimits";
import { getAllConfig } from "./config";
import { reserve } from "./budget";
import { siteDay } from "./lib/days";

const MIN_VOTES_TO_BUILD = 1;

/** The board: safe-but-big asks people can vote on. Newest-and-most-wanted first. */
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
      out.push({
        id: r._id,
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
 * fails at build. Rationing to one per run keeps big builds affordable no matter how many are proposed.
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
    if (!top || (top.proposalVotes ?? 0) < MIN_VOTES_TO_BUILD || !top.verdict) return { promoted: false };

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
    return { promoted: true, requestId: cloneId, votes: top.proposalVotes ?? 0 };
  },
});

/** How many proposals are open, for the section header. */
export const count = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("requests").withIndex("by_status", (q) => q.eq("status", "proposed")).take(100);
    return rows.length;
  },
});
