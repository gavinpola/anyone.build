import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const SESSION_RE = /^[a-z0-9:_-]{8,80}$/i;
const FRESH_MS = 5_000;
const MAX_CURSORS = 24; // render cap; also bounds the O(n^2) subscription cost

/** Throttled upsert of one tab's cursor, in tiles (the world's unit; fractional, negative is normal). Client throttles to ~200ms. */
export const move = mutation({
  args: { roomId: v.string(), sessionId: v.string(), x: v.number(), y: v.number(), hue: v.number(), name: v.optional(v.string()) },
  handler: async (ctx, { roomId, sessionId, x, y, hue, name }) => {
    if (!SESSION_RE.test(sessionId) || roomId.length > 32) return;
    // clamp so a bad client can't store garbage: the world is unbounded but nobody is a thousand tiles out
    const cx = Number.isFinite(x) ? Math.max(-1000, Math.min(1000, x)) : 0;
    const cy = Number.isFinite(y) ? Math.max(-1000, Math.min(1000, y)) : 0;
    const h = Math.max(0, Math.min(360, Math.round(hue)));
    const now = Date.now();
    const existing = await ctx.db
      .query("cursors")
      .withIndex("by_room_session", (q) => q.eq("roomId", roomId).eq("sessionId", sessionId))
      .unique();
    const label = (name ?? "").replace(/[^\w .·-]/g, "").slice(0, 24) || undefined;
    if (existing) await ctx.db.patch(existing._id, { x: cx, y: cy, hue: h, at: now, name: label });
    else await ctx.db.insert("cursors", { roomId, sessionId, x: cx, y: cy, hue: h, at: now, name: label });
  },
});

/** Remove this tab's cursor (on leave / tab hidden). */
export const leave = mutation({
  args: { roomId: v.string(), sessionId: v.string() },
  handler: async (ctx, { roomId, sessionId }) => {
    const existing = await ctx.db
      .query("cursors")
      .withIndex("by_room_session", (q) => q.eq("roomId", roomId).eq("sessionId", sessionId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

/** Everyone else's fresh cursors, newest first, capped. Excludes the caller's own session. */
export const active = query({
  args: { roomId: v.string(), sessionId: v.string() },
  handler: async (ctx, { roomId, sessionId }) => {
    const cutoff = Date.now() - FRESH_MS;
    const rows = await ctx.db
      .query("cursors")
      .withIndex("by_room_at", (q) => q.eq("roomId", roomId).gt("at", cutoff))
      .order("desc")
      .take(MAX_CURSORS + 8);
    return rows
      .filter((c) => c.sessionId !== sessionId)
      .slice(0, MAX_CURSORS)
      .map((c) => ({ id: c.sessionId, x: c.x, y: c.y, hue: c.hue, name: c.name ?? null, at: c.at }));
  },
});
