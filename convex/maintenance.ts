import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { rateLimiter } from "./rateLimits";

/** Proposals nobody voted for in a week come off the board. */
export const expireStaleProposals = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    const rows = await ctx.db.query("requests").withIndex("by_status", (q) => q.eq("status", "proposed").lt("createdAt", cutoff)).take(200);
    let n = 0;
    for (const r of rows) {
      if ((r.proposalVotes ?? 0) > 0) continue;
      await ctx.db.patch(r._id, { status: "rejected", verdict: r.verdict ? { ...r.verdict, hint: "Nobody voted for this one in a week. Ask again if you still want it." } : undefined, updatedAt: Date.now() });
      n++;
    }
    return n;
  },
});

/** Requests waiting on a human expire after a day so the queue never rots and never swallows new asks. */
export const expireNeedsHuman = internalMutation({
  args: { olderThanMs: v.optional(v.number()) },
  handler: async (ctx, { olderThanMs }) => {
    const cutoff = Date.now() - (olderThanMs ?? 24 * 3600 * 1000);
    const rows = await ctx.db.query("requests").withIndex("by_status", (q) => q.eq("status", "needs_human").lt("createdAt", cutoff)).take(200);
    for (const r of rows) {
      await ctx.db.patch(r._id, {
        status: "rejected",
        verdict: r.verdict ? { ...r.verdict, approved: false, category: "unclear", hint: "Nobody got to this one in time. Ask again, smaller." } : undefined,
        updatedAt: Date.now(),
      });
    }
    return rows.length;
  },
});

/**
 * Reset everyone's per-person submit windows. A fixed-window bucket stores tokens REMAINING, so
 * loosening a limit doesn't unblock a window that was already exhausted under the old rate until it
 * rolls over. Run this once after raising the submit caps. Keys are handled server-side only.
 */
export const resetSubmitWindows = internalMutation({
  args: {},
  handler: async (ctx) => {
    let n = 0;
    const guests = await ctx.db.query("guests").take(5000);
    for (const g of guests) {
      await rateLimiter.reset(ctx, "submitGuest", { key: `g:${g.guestId}` });
      n++;
    }
    const users = await ctx.db.query("users").take(5000);
    for (const u of users) {
      for (const name of ["submitTrust0", "submitTrust1", "submitTrust2", "submitTrust3"] as const) {
        await rateLimiter.reset(ctx, name, { key: u._id });
      }
      n++;
    }
    return { reset: n };
  },
});
