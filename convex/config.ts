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
  guestsEnabled: true,
  // Agent-written backend functions (convex/rooms/**). Off until Convex deploys on merge (CONVEX_DEPLOY_KEY on Vercel).
  backendEnabled: false,
  guestHourlyCap: 300, // global guest asks/hour; the daily budget is the money backstop
  // Three vendors on purpose: one jailbreak shouldn't fool all three. All cheap, all fast.
  // Measured 2026-09-03 through OpenRouter (structured output + tool calls): Gemini Flash-Lite ~1s,
  // DeepSeek V4 Flash ~3s per coding step, GLM 5.3 Flash ~20-36s (too slow for the loop).
  judgeModel: "google/gemini-2.5-flash", // reliable intent+scope calls; flash-lite mis-judged reasonable asks
  redTeamModel: "google/gemini-3.1-flash-lite", // always answers, <2s; gpt-5-nano returned empty at low caps
  reviewModel: "qwen/qwen3-coder-next",
  securityModel: "google/gemini-3.1-flash-lite",
  coderModel: "deepseek/deepseek-v4-flash-0731", // tiny + small (and the fast path)
  // Bigger asks get better coders. Medium is every creative ask, so a mid-price coder; large only builds when a
  // proposal wins the daily vote (≤1/day), so the best one is affordable. Each build is still capped by scopeCapsCents.
  coderModelMedium: "qwen/qwen3-coder-plus",
  coderModelLarge: "anthropic/claude-sonnet-5",
  // Tiny asks on one existing file: one model call, no sandbox (pipeline/fast.ts); the sandbox is the fallback.
  fastPathEnabled: true,
  fastModel: "", // empty = coderModel
  maxTurns: 40,
  sandboxTimeoutMs: 12 * 60 * 1000,
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
      coderModelMedium: c.coderModelMedium,
      coderModelLarge: c.coderModelLarge,
      fastPathEnabled: c.fastPathEnabled,
      fastModel: c.fastModel,
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
