import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getViewerUser, requireUser } from "./users";
import { rateLimiter } from "./rateLimits";

export const toggle = mutation({
  args: { changeId: v.id("changes") },
  handler: async (ctx, { changeId }) => {
    const user = await requireUser(ctx);
    await rateLimiter.limit(ctx, "storeWrite", { key: `vote:${user._id}`, throws: true });
    const c = await ctx.db.get(changeId);
    if (!c || c.revertedAt) return { voted: false, votes: c?.votes ?? 0 };
    const existing = await ctx.db
      .query("votes")
      .withIndex("by_change_user", (q) => q.eq("changeId", changeId).eq("userId", user._id))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      const votes = Math.max(0, (c.votes ?? 0) - 1);
      await ctx.db.patch(changeId, { votes });
      return { voted: false, votes };
    }
    if (c.userId && c.userId === user._id) throw new Error("You can't vote for your own change.");
    await ctx.db.insert("votes", { changeId, userId: user._id, createdAt: Date.now() });
    const votes = (c.votes ?? 0) + 1;
    await ctx.db.patch(changeId, { votes });
    return { voted: true, votes };
  },
});

/** Recent live changes for the leaderboard, with the viewer's vote state. */
export const recentChanges = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const viewer = await getViewerUser(ctx);
    const rows = await ctx.db.query("changes").withIndex("by_mergedAt").order("desc").take(Math.min(limit ?? 50, 200));
    const out = [];
    for (const c of rows) {
      if (c.revertedAt) continue;
      const u = c.userId ? await ctx.db.get(c.userId) : null;
      let myVote = false;
      if (viewer) {
        const vrow = await ctx.db
          .query("votes")
          .withIndex("by_change_user", (q) => q.eq("changeId", c._id).eq("userId", viewer._id))
          .unique();
        myVote = Boolean(vrow);
      }
      out.push({
        id: c._id,
        summary: c.summary,
        by: { handle: u?.handle ?? "a guest", avatarUrl: u?.avatarUrl ?? null },
        mine: viewer ? c.userId === viewer._id : false,
        blockIds: c.blockIds,
        linesAdded: c.linesAdded,
        linesRemoved: c.linesRemoved,
        prUrl: c.prUrl,
        mergedAt: c.mergedAt,
        votes: c.votes ?? 0,
        myVote,
      });
    }
    return out;
  },
});
