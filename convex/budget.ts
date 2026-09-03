import { v } from "convex/values";
import { internalMutation, query, type MutationCtx } from "./_generated/server";
import { siteDay } from "./lib/days";
import { getAllConfig, getConfig } from "./config";

export async function getOrCreateDay(ctx: MutationCtx, day = siteDay()) {
  const existing = await ctx.db
    .query("budgets")
    .withIndex("by_day", (q) => q.eq("day", day))
    .unique();
  if (existing) return existing;
  const cap = await getConfig(ctx, "dailyBudgetCents");
  const id = await ctx.db.insert("budgets", { day, capCents: cap, spentCents: 0, reservedCents: 0, topUpCents: 0 });
  return (await ctx.db.get(id))!;
}

export const today = query({
  args: {},
  handler: async (ctx) => {
    const day = siteDay();
    const b = await ctx.db
      .query("budgets")
      .withIndex("by_day", (q) => q.eq("day", day))
      .unique();
    const c = await getAllConfig(ctx);
    const cap = (b?.capCents ?? c.dailyBudgetCents) + (b?.topUpCents ?? 0);
    return {
      day,
      capCents: cap,
      spentCents: b?.spentCents ?? 0,
      reservedCents: b?.reservedCents ?? 0,
      availableCents: Math.max(0, cap - (b?.spentCents ?? 0) - (b?.reservedCents ?? 0)),
    };
  },
});

/** Reserve up to `cents` for a request. Returns false if the day is spent. */
export async function reserve(ctx: MutationCtx, cents: number): Promise<boolean> {
  const b = await getOrCreateDay(ctx);
  const available = b.capCents + b.topUpCents - b.spentCents - b.reservedCents;
  if (available < cents) return false;
  await ctx.db.patch(b._id, { reservedCents: b.reservedCents + cents });
  return true;
}

export const settle = internalMutation({
  args: { day: v.string(), reservedCents: v.number(), spentCents: v.number() },
  handler: async (ctx, { day, reservedCents, spentCents }) => {
    const b = await getOrCreateDay(ctx, day);
    await ctx.db.patch(b._id, {
      reservedCents: Math.max(0, b.reservedCents - reservedCents),
      spentCents: b.spentCents + Math.max(0, spentCents),
    });
  },
});

export const topUp = internalMutation({
  args: { day: v.string(), cents: v.number() },
  handler: async (ctx, { day, cents }) => {
    const b = await getOrCreateDay(ctx, day);
    await ctx.db.patch(b._id, { topUpCents: b.topUpCents + Math.max(0, cents) });
  },
});
