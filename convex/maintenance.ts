import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

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
