import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/** Idempotency: returns false if this event id was already processed. */
export const record = internalMutation({
  args: { source: v.union(v.literal("github"), v.literal("vercel"), v.literal("stripe")), eventId: v.string(), type: v.string() },
  handler: async (ctx, { source, eventId, type }) => {
    if (!eventId) return true;
    const existing = await ctx.db
      .query("webhookEvents")
      .withIndex("by_source_event", (q) => q.eq("source", source).eq("eventId", eventId))
      .unique();
    if (existing) return false;
    await ctx.db.insert("webhookEvents", { source, eventId, type, receivedAt: Date.now() });
    return true;
  },
});
