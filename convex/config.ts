import { v } from "convex/values";
import { internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { requireUser } from "./users";

export const DEFAULTS = {
  dailyBudgetCents: 2000,
  maxConcurrentBuilds: 8,
  redTeamConfidenceBelow: 0.8,
  scopeCapsCents: { tiny: 50, small: 100, medium: 250, large: 600 },
  scopeLineLimits: { tiny: 60, small: 250, medium: 700, large: 1500 },
  maxBlockLines: 400,
  minBidCents: 500,
  bidStepCents: 100,
  patronTopUpPct: 50,
  pinSeconds: 60,
  flagsToNotify: 5,
  judgeModel: "openai/gpt-5-nano",
  redTeamModel: "anthropic/claude-sonnet-5",
  reviewModel: "anthropic/claude-haiku-4.5",
  coderModel: "anthropic/claude-sonnet-5",
  maxTurns: 40,
  sandboxTimeoutMs: 6 * 60 * 1000,
} as const;

export type ConfigKey = keyof typeof DEFAULTS;

export async function getConfig<K extends ConfigKey>(ctx: QueryCtx, key: K): Promise<(typeof DEFAULTS)[K]> {
  const row = await ctx.db
    .query("config")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  return (row?.value as (typeof DEFAULTS)[K]) ?? DEFAULTS[key];
}

export async function getAllConfig(ctx: QueryCtx): Promise<typeof DEFAULTS> {
  const rows = await ctx.db.query("config").collect();
  const out: Record<string, unknown> = { ...DEFAULTS };
  for (const r of rows) if (r.key in DEFAULTS) out[r.key] = r.value;
  return out as typeof DEFAULTS;
}

export const all = internalQuery({
  args: {},
  handler: async (ctx) => getAllConfig(ctx),
});

export const publicConfig = query({
  args: {},
  handler: async (ctx) => {
    const c = await getAllConfig(ctx);
    return {
      dailyBudgetCents: c.dailyBudgetCents,
      minBidCents: c.minBidCents,
      bidStepCents: c.bidStepCents,
      patronTopUpPct: c.patronTopUpPct,
      judgeModel: c.judgeModel,
      coderModel: c.coderModel,
    };
  },
});

/** Full config for maintainers (the public one hides model names etc. only by omission; nothing here is secret). */
export const all_public = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx).catch(() => null);
    if (!user || user.trust < 3) return null;
    return getAllConfig(ctx);
  },
});

export const set = mutation({
  args: { key: v.string(), value: v.any() },
  handler: async (ctx, { key, value }) => {
    const user = await requireUser(ctx);
    if (user.trust < 3) throw new Error("Maintainers only");
    if (!(key in DEFAULTS)) throw new Error("Unknown key");
    const row = await ctx.db
      .query("config")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (row) await ctx.db.patch(row._id, { value, updatedAt: Date.now() });
    else await ctx.db.insert("config", { key, value, updatedAt: Date.now() });
  },
});
