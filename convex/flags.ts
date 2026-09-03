import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./users";
import { rateLimiter } from "./rateLimits";
import { getConfig } from "./config";

export const flag = mutation({
  args: { changeId: v.id("changes"), reason: v.string() },
  handler: async (ctx, { changeId, reason }) => {
    const user = await requireUser(ctx);
    if (user.trust < 1) throw new Error("New accounts can't flag yet.");
    await rateLimiter.limit(ctx, "flag", { key: user._id, throws: true });
    const existing = await ctx.db
      .query("flags")
      .withIndex("by_change_user", (q) => q.eq("changeId", changeId).eq("userId", user._id))
      .unique();
    if (existing) return;
    const c = await ctx.db.get(changeId);
    if (!c) return;
    await ctx.db.insert("flags", { changeId, userId: user._id, reason: reason.slice(0, 200), createdAt: Date.now() });
    await ctx.db.patch(changeId, { flagCount: c.flagCount + 1 });
  },
});

export const flagged = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (user.trust < 3) return [];
    const threshold = await getConfig(ctx, "flagsToNotify");
    const recent = await ctx.db.query("changes").withIndex("by_mergedAt").order("desc").take(500);
    return recent.filter((c) => c.flagCount >= Math.min(threshold, 1) && !c.revertedAt).map((c) => ({ id: c._id, summary: c.summary, flagCount: c.flagCount, prUrl: c.prUrl, mergedAt: c.mergedAt }));
  },
});
