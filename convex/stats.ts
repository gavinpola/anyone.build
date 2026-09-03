import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { siteDay, siteDayStart } from "./lib/days";

export const global = query({
  args: {},
  handler: async (ctx) => {
    const s = await ctx.db
      .query("stats")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    const dayStart = siteDayStart(siteDay());
    const todays = await ctx.db
      .query("changes")
      .withIndex("by_mergedAt", (q) => q.gte("mergedAt", dayStart))
      .collect();
    return {
      changesAllTime: s?.changesAllTime ?? 0,
      requestsAllTime: s?.requestsAllTime ?? 0,
      revenueCents: s?.revenueCents ?? 0,
      changesToday: todays.length,
      // Coarse on purpose: identical results aren't re-sent, so the header counter doesn't fan out on every pageview.
      viewsAllTime: coarse(s?.viewsAllTime ?? 0),
    };
  },
});

export function coarse(n: number) {
  if (n < 1000) return n;
  if (n < 100_000) return Math.floor(n / 10) * 10;
  return Math.floor(n / 100) * 100;
}

export const bump = internalMutation({
  args: { changes: v.optional(v.number()), requests: v.optional(v.number()), revenueCents: v.optional(v.number()) },
  handler: async (ctx, d) => {
    const s = await ctx.db
      .query("stats")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    if (!s) {
      await ctx.db.insert("stats", {
        key: "global",
        changesAllTime: d.changes ?? 0,
        requestsAllTime: d.requests ?? 0,
        revenueCents: d.revenueCents ?? 0,
      });
      return;
    }
    await ctx.db.patch(s._id, {
      changesAllTime: s.changesAllTime + (d.changes ?? 0),
      requestsAllTime: s.requestsAllTime + (d.requests ?? 0),
      revenueCents: s.revenueCents + (d.revenueCents ?? 0),
    });
  },
});
