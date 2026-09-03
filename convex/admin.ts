import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./users";
import { toFeed } from "./requests";

export const needsHuman = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (user.trust < 3) return [];
    const rows = await ctx.db.query("requests").withIndex("by_status", (q) => q.eq("status", "needs_human")).order("desc").take(100);
    const out = [];
    for (const r of rows) out.push({ ...(await toFeed(ctx, r, user._id)), plan: r.verdict?.plan ?? [], confidence: r.verdict?.confidence ?? 0 });
    return out;
  },
});

export const revert = mutation({
  args: { changeId: v.id("changes"), reason: v.optional(v.string()) },
  handler: async (ctx, { changeId }) => {
    const user = await requireUser(ctx);
    if (user.trust < 3) throw new Error("Maintainers only");
    const c = await ctx.db.get(changeId);
    if (!c || c.revertedAt) return;
    await ctx.db.patch(changeId, { revertedAt: Date.now(), revertedBy: user._id });
    await ctx.runMutation(internal.users.adjustStats, { userId: c.userId, liveChanges: -1, reverted: 1, strikes: 1 });
    if (process.env.EXECUTOR === "sandbox") {
      await ctx.scheduler.runAfter(0, internal.pipeline.github.revertChange, { changeId });
    }
  },
});

export const ban = mutation({
  args: { userId: v.id("users"), banned: v.boolean() },
  handler: async (ctx, { userId, banned }) => {
    const user = await requireUser(ctx);
    if (user.trust < 3) throw new Error("Maintainers only");
    await ctx.db.patch(userId, { banned });
  },
});
