import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

/** The latest baked picture of a whiteboard namespace: a PNG url, when, and how many strokes it holds. Tiny, so every viewer can subscribe. */
export const latest = query({
  args: { namespace: v.string() },
  handler: async (ctx, { namespace }) => {
    const b = await ctx.db.query("artBakes").withIndex("by_namespace", (q) => q.eq("namespace", namespace)).unique();
    if (!b) return null;
    const url = await ctx.storage.getUrl(b.storageId);
    return url ? { url, at: b.at, count: b.count } : null;
  },
});

export const record = internalMutation({
  args: { namespace: v.string(), storageId: v.id("_storage"), count: v.number(), bytes: v.number(), newestDocAt: v.number() },
  handler: async (ctx, { namespace, storageId, count, bytes, newestDocAt }) => {
    const prev = await ctx.db.query("artBakes").withIndex("by_namespace", (q) => q.eq("namespace", namespace)).unique();
    if (prev) {
      await ctx.storage.delete(prev.storageId).catch(() => {});
      await ctx.db.patch(prev._id, { storageId, at: Date.now(), count, bytes, newestDocAt });
    } else {
      await ctx.db.insert("artBakes", { namespace, storageId, at: Date.now(), count, bytes, newestDocAt });
    }
  },
});

export const bakeState = query({
  args: { namespace: v.string() },
  handler: async (ctx, { namespace }) => {
    const b = await ctx.db.query("artBakes").withIndex("by_namespace", (q) => q.eq("namespace", namespace)).unique();
    return b ? { newestDocAt: b.newestDocAt, count: b.count } : null;
  },
});
