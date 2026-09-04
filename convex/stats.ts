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

/**
 * How it's going, without anyone's words: counts of asks by outcome over the last N days, why the
 * rejected ones were rejected (category), how the failed ones failed (the hint the requester saw, and
 * the pipeline's own error line), and how long live changes took. No prompts, no ids, no names.
 */
export const outcomes = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, { days }) => {
    const d = Math.max(1, Math.min(30, Math.floor(days ?? 7)));
    const cutoff = Date.now() - d * 24 * 3600 * 1000;
    const statuses = ["live", "rejected", "failed", "proposed", "queued", "building", "validating", "reviewing", "preview", "merging", "judging", "cancelled", "needs_human"] as const;
    const byStatus: Record<string, number> = {};
    const rejectedBy: Record<string, number> = {};
    const failedBy: Record<string, number> = {};
    const scopes: Record<string, number> = {};
    const recentFailures: Array<{ at: number; scope: string | null; hint: string; error: string | null; log: string[]; costCents: number | null; turns: number | null; fastFailed: boolean }> = [];
    const buildSeconds: number[] = [];
    for (const status of statuses) {
      const rows = await ctx.db
        .query("requests")
        .withIndex("by_status", (q) => q.eq("status", status).gt("createdAt", cutoff))
        .order("desc")
        .take(500);
      byStatus[status] = rows.length;
      for (const r of rows) {
        if (status === "rejected") rejectedBy[r.verdict?.category ?? "none"] = (rejectedBy[r.verdict?.category ?? "none"] ?? 0) + 1;
        if (status === "live" || status === "failed" || status === "proposed") scopes[r.verdict?.scope ?? "?"] = (scopes[r.verdict?.scope ?? "?"] ?? 0) + 1;
        if (status === "live") buildSeconds.push(Math.round((r.updatedAt - r.createdAt) / 1000));
        if (status === "failed") {
          const key = (r.verdict?.hint ?? r.run?.error ?? "unknown").slice(0, 70);
          failedBy[key] = (failedBy[key] ?? 0) + 1;
          if (recentFailures.length < 25) {
            // the runner's own step lines are metadata (tool names, token counts, timings), never anyone's words
            const lines = (r.run?.error ?? "").split("\n");
            const log = lines.filter((l) => /^\[runner/.test(l.trim()) || /^(checks failed|the agent made no changes|CI failed|review rejected)/i.test(l.trim())).slice(0, 40).map((l) => l.trim().slice(0, 140));
            recentFailures.push({ at: r.createdAt, scope: r.verdict?.scope ?? null, hint: (r.verdict?.hint ?? "").slice(0, 120), error: lines[0] ? lines[0].slice(0, 160) : null, log, costCents: r.run?.costCents ?? null, turns: r.run?.turns ?? null, fastFailed: Boolean(r.run?.fastFailed) });
          }
        }
      }
    }
    buildSeconds.sort((a, b) => a - b);
    const median = buildSeconds.length ? buildSeconds[Math.floor(buildSeconds.length / 2)]! : null;
    const p90 = buildSeconds.length ? buildSeconds[Math.floor(buildSeconds.length * 0.9)]! : null;
    return { days: d, byStatus, rejectedBy, failedBy, scopes, recentFailures, liveBuildSeconds: { median, p90, n: buildSeconds.length } };
  },
});

