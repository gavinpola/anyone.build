import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { siteDay } from "./lib/days";

const SESSION_RE = /^[a-f0-9]{16,64}$/;
const ROUTE_RE = /^\/[a-z0-9/@._-]{0,80}$/i;

/** One call per route view. Cookieless: the client keeps a random per-tab id in sessionStorage. */
export const pageview = mutation({
  args: { route: v.string(), sessionHash: v.string() },
  handler: async (ctx, { route, sessionHash }) => {
    if (!SESSION_RE.test(sessionHash) || !ROUTE_RE.test(route)) return;
    const day = siteDay();
    const r = route.split("?")[0]!.replace(/\/+$/, "") || "/";
    const stats = await ctx.db.query("dayStats").withIndex("by_day", (q) => q.eq("day", day)).unique();
    const seen = await ctx.db
      .query("visitors")
      .withIndex("by_day_session", (q) => q.eq("day", day).eq("sessionHash", sessionHash))
      .unique();
    let unique = 0;
    if (!seen) {
      await ctx.db.insert("visitors", { day, sessionHash });
      unique = 1;
    }
    if (stats) await ctx.db.patch(stats._id, { views: stats.views + 1, uniques: stats.uniques + unique });
    else await ctx.db.insert("dayStats", { day, views: 1, uniques: unique, clicks: 0 });
    const g = await ctx.db.query("stats").withIndex("by_key", (q) => q.eq("key", "global")).unique();
    if (g) await ctx.db.patch(g._id, { viewsAllTime: (g.viewsAllTime ?? 0) + 1 });
    else await ctx.db.insert("stats", { key: "global", changesAllTime: 0, requestsAllTime: 0, revenueCents: 0, viewsAllTime: 1 });
    const rv = await ctx.db
      .query("routeViews")
      .withIndex("by_day_route", (q) => q.eq("day", day).eq("route", r))
      .unique();
    if (rv) await ctx.db.patch(rv._id, { views: rv.views + 1 });
    else await ctx.db.insert("routeViews", { day, route: r, views: 1 });
  },
});

/** Public traffic summary for the patron page: last N days. */
export const summary = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, { days }) => {
    const n = Math.min(days ?? 30, 90);
    const out: Array<{ day: string; views: number; uniques: number; clicks: number }> = [];
    const now = Date.now();
    for (let i = n - 1; i >= 0; i--) {
      const day = siteDay(now - i * 86400000);
      const s = await ctx.db.query("dayStats").withIndex("by_day", (q) => q.eq("day", day)).unique();
      out.push({ day, views: s?.views ?? 0, uniques: s?.uniques ?? 0, clicks: s?.clicks ?? 0 });
    }
    const totals = out.reduce((a, d) => ({ views: a.views + d.views, uniques: a.uniques + d.uniques, clicks: a.clicks + d.clicks }), { views: 0, uniques: 0, clicks: 0 });
    return { days: out, totals, today: out[out.length - 1]!, yesterday: out[out.length - 2] ?? null };
  },
});
