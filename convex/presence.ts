import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

/**
 * "N here now" that stays cheap at 1,000+ concurrent visitors.
 * Each tab heartbeats once a minute; we count distinct tabs per minute bucket.
 * The query reads two small docs, so re-running it on every heartbeat costs almost nothing,
 * and clients receive a single number instead of a list of everyone present.
 */
const SESSION_RE = /^[a-z0-9:_-]{8,80}$/i;
const minuteOf = (ts: number) => Math.floor(ts / 60_000);

export const heartbeat = mutation({
  args: { roomId: v.string(), sessionId: v.string() },
  handler: async (ctx, { roomId, sessionId }) => {
    if (!SESSION_RE.test(sessionId) || roomId.length > 32) return;
    const minute = minuteOf(Date.now());
    const s = await ctx.db
      .query("presenceSessions")
      .withIndex("by_room_session", (q) => q.eq("roomId", roomId).eq("sessionId", sessionId))
      .unique();
    if (s && s.minute === minute) return;
    if (s) await ctx.db.patch(s._id, { minute });
    else await ctx.db.insert("presenceSessions", { roomId, sessionId, minute });
    const b = await ctx.db
      .query("presenceBuckets")
      .withIndex("by_room_minute", (q) => q.eq("roomId", roomId).eq("minute", minute))
      .unique();
    if (b) await ctx.db.patch(b._id, { count: b.count + 1 });
    else await ctx.db.insert("presenceBuckets", { roomId, minute, count: 1 });
  },
});

export const online = query({
  args: { roomId: v.string() },
  handler: async (ctx, { roomId }) => {
    const m = minuteOf(Date.now());
    let total = 0;
    for (const minute of [m, m - 1]) {
      const b = await ctx.db
        .query("presenceBuckets")
        .withIndex("by_room_minute", (q) => q.eq("roomId", roomId).eq("minute", minute))
        .unique();
      total = Math.max(total, b?.count ?? 0);
    }
    return total;
  },
});

/** Cron: drop stale sessions and old buckets. */
export const sweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = minuteOf(Date.now()) - 10;
    const stale = await ctx.db.query("presenceSessions").take(2000);
    for (const s of stale) if (s.minute < cutoff) await ctx.db.delete(s._id);
    const old = await ctx.db.query("presenceBuckets").take(2000);
    for (const b of old) if (b.minute < cutoff) await ctx.db.delete(b._id);
    const cursorCutoff = Date.now() - 10_000;
    const cursors = await ctx.db.query("cursors").take(3000);
    for (const c of cursors) if (c.at < cursorCutoff) await ctx.db.delete(c._id);
  },
});
