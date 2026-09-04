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
    for (const r of rows) out.push({ ...(await toFeed(ctx, r, { userId: user._id, guestId: null })), plan: r.verdict?.plan ?? [], confidence: r.verdict?.confidence ?? 0 });
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
    if (c.userId) await ctx.runMutation(internal.users.adjustStats, { userId: c.userId, liveChanges: -1, reverted: 1, strikes: 1 });
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

/** Spend, for the admin page: the last 7 days' budgets and what the last 200 finished builds cost by scope. */
export const costs = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx).catch(() => null);
    if (!user || user.trust < 3) return null;
    const days = await ctx.db.query("budgets").withIndex("by_day").order("desc").take(7);
    const recent = await ctx.db.query("requests").order("desc").take(200);
    const byScope: Record<string, { n: number; cents: number; live: number; failed: number }> = {};
    let total = 0;
    for (const r of recent) {
      const c = r.run?.costCents ?? 0;
      if (!r.verdict || (r.status !== "live" && r.status !== "failed")) continue;
      const k = r.verdict.scope;
      byScope[k] ??= { n: 0, cents: 0, live: 0, failed: 0 };
      byScope[k].n++;
      byScope[k].cents += c;
      if (r.status === "live") byScope[k].live++;
      else byScope[k].failed++;
      total += c;
    }
    return {
      days: days.map((d) => ({ day: d.day, capCents: d.capCents, spentCents: d.spentCents, reservedCents: d.reservedCents, topUpCents: d.topUpCents })),
      byScope: Object.entries(byScope).map(([scope, v]) => ({ scope, ...v, avgCents: v.n ? v.cents / v.n : 0 })),
      finished: Object.values(byScope).reduce((a, v) => a + v.n, 0),
      totalCents: total,
    };
  },
});

