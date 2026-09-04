import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { rateLimiter } from "./rateLimits";

/**
 * Decay. Nothing on the wall survives being ignored: every block has a clock, touching it (playing,
 * clicking, moving, changing it) resets the clock, and when it runs out the block fades from the wall.
 * Fading hides; it never deletes. A touch revives. The window is set in src/rooms/<room>/canvas.ts
 * (`decay`), read by the wall; the server only records touches and, once a day, marks what ran out.
 * Pinned blocks (meta `pinned: true`) are never faded: the wall doesn't send touches for them and the
 * sweep skips ids it's told to.
 */
const ID_RE = /^[a-z0-9-]{1,60}$/;

export const list = query({
  args: { roomId: v.optional(v.string()) },
  handler: async (ctx, { roomId }) => {
    const rows = await ctx.db.query("blockLife").withIndex("by_room_block", (q) => q.eq("roomId", roomId ?? "main")).take(500);
    return rows.map((r) => ({ blockId: r.blockId, lastTouchedAt: r.lastTouchedAt, touches: r.touches, fadedAt: r.fadedAt ?? null }));
  },
});

export const touch = mutation({
  args: { roomId: v.optional(v.string()), blockId: v.string(), anonId: v.optional(v.string()) },
  handler: async (ctx, { roomId, blockId, anonId }) => {
    if (!ID_RE.test(blockId)) return;
    const room = roomId ?? "main";
    const key = `t:${(anonId ?? "anon").replace(/[^a-z0-9]/gi, "").slice(0, 40) || "anon"}:${blockId}`;
    const ok = await rateLimiter.limit(ctx, "touch", { key });
    if (!ok.ok) return;
    const now = Date.now();
    const row = await ctx.db.query("blockLife").withIndex("by_room_block", (q) => q.eq("roomId", room).eq("blockId", blockId)).unique();
    if (row) await ctx.db.patch(row._id, { lastTouchedAt: now, touches: row.touches + 1, fadedAt: undefined });
    else await ctx.db.insert("blockLife", { roomId: room, blockId, lastTouchedAt: now, touches: 1 });
  },
});

/** A landed change is the strongest touch. Called from the pipeline when a change goes live. */
export const touchInternal = internalMutation({
  args: { roomId: v.string(), blockIds: v.array(v.string()) },
  handler: async (ctx, { roomId, blockIds }) => {
    const now = Date.now();
    for (const blockId of blockIds) {
      if (!ID_RE.test(blockId)) continue;
      const row = await ctx.db.query("blockLife").withIndex("by_room_block", (q) => q.eq("roomId", roomId).eq("blockId", blockId)).unique();
      if (row) await ctx.db.patch(row._id, { lastTouchedAt: now, touches: row.touches + 1, fadedAt: undefined });
      else await ctx.db.insert("blockLife", { roomId, blockId, lastTouchedAt: now, touches: 1 });
    }
  },
});

/** Once a day: mark what ran out. `days` is the window; `keep` are ids that never fade (pinned). */
export const sweep = internalMutation({
  args: { roomId: v.optional(v.string()), days: v.optional(v.number()), keep: v.optional(v.array(v.string())) },
  handler: async (ctx, { roomId, days, keep }) => {
    const window = Math.max(1, Math.min(365, days ?? 7)) * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - window;
    const skip = new Set(keep ?? []);
    const rows = await ctx.db.query("blockLife").withIndex("by_room_block", (q) => q.eq("roomId", roomId ?? "main")).take(500);
    let faded = 0;
    for (const r of rows) {
      if (skip.has(r.blockId) || r.fadedAt || r.lastTouchedAt > cutoff) continue;
      await ctx.db.patch(r._id, { fadedAt: Date.now() });
      faded++;
    }
    return faded;
  },
});
