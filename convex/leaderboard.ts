import { v } from "convex/values";
import { query } from "./_generated/server";
import { publicUser } from "./users";

const WEEK = 7 * 24 * 3600 * 1000;

export const top = query({
  args: { period: v.union(v.literal("week"), v.literal("all")), metric: v.optional(v.union(v.literal("changes"), v.literal("lines"))), limit: v.optional(v.number()) },
  handler: async (ctx, { period, metric, limit }) => {
    const byLines = metric === "lines";
    const n = Math.min(limit ?? 50, 100);
    // "Still standing": whose change is the latest on each block right now.
    const recent = await ctx.db.query("changes").withIndex("by_mergedAt").order("desc").take(2000);
    const latestByBlock = new Map<string, string>();
    for (const c of recent) {
      if (c.revertedAt || !c.primaryBlockId) continue;
      if (!latestByBlock.has(c.primaryBlockId)) latestByBlock.set(c.primaryBlockId, c.userId);
    }
    const standing = new Map<string, number>();
    for (const uid of latestByBlock.values()) standing.set(uid, (standing.get(uid) ?? 0) + 1);

    if (period === "all") {
      const users = byLines
        ? await ctx.db.query("users").withIndex("by_linesChanged").order("desc").take(n)
        : await ctx.db.query("users").withIndex("by_liveChanges").order("desc").take(n);
      return users
        .filter((u) => u.liveChanges > 0)
        .map((u) => ({ ...publicUser(u), standing: standing.get(u._id) ?? 0, weekChanges: null as number | null, weekLines: null as number | null }));
    }
    const since = Date.now() - WEEK;
    const agg = new Map<string, { changes: number; lines: number }>();
    for (const c of recent) {
      if (c.mergedAt < since) break;
      if (c.revertedAt) continue;
      const a = agg.get(c.userId) ?? { changes: 0, lines: 0 };
      a.changes++;
      a.lines += c.linesAdded + c.linesRemoved;
      agg.set(c.userId, a);
    }
    const rows = [...agg.entries()].sort((a, b) => (byLines ? b[1].lines - a[1].lines || b[1].changes - a[1].changes : b[1].changes - a[1].changes || b[1].lines - a[1].lines)).slice(0, n);
    const out = [];
    for (const [uid, a] of rows) {
      const u = await ctx.db.get(uid as never);
      if (!u || !("handle" in u)) continue;
      out.push({ ...publicUser(u), weekChanges: a.changes, weekLines: a.lines, standing: standing.get(uid) ?? 0 });
    }
    return out;
  },
});

export const profile = query({
  args: { handle: v.string() },
  handler: async (ctx, { handle }) => {
    const u = await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", handle.toLowerCase()))
      .unique();
    if (!u) return null;
    const changes = await ctx.db
      .query("changes")
      .withIndex("by_user", (q) => q.eq("userId", u._id))
      .order("desc")
      .take(50);
    return {
      user: publicUser(u),
      changes: changes.map((c) => ({
        id: c._id,
        summary: c.summary,
        blockIds: c.blockIds,
        linesAdded: c.linesAdded,
        linesRemoved: c.linesRemoved,
        prUrl: c.prUrl,
        mergedAt: c.mergedAt,
        reverted: Boolean(c.revertedAt),
      })),
    };
  },
});

export const blockProvenance = query({
  args: { roomId: v.optional(v.string()) },
  handler: async (ctx, { roomId }) => {
    const recent = await ctx.db.query("changes").withIndex("by_mergedAt").order("desc").take(1000);
    const out: Record<string, { lastBy: string; changes: number }> = {};
    for (const c of recent) {
      if (c.roomId !== (roomId ?? "main") || c.revertedAt) continue;
      for (const b of c.blockIds) {
        const cur = out[b];
        if (!cur) {
          const u = await ctx.db.get(c.userId);
          out[b] = { lastBy: u?.handle ?? "someone", changes: 1 };
        } else cur.changes++;
      }
    }
    return out;
  },
});
