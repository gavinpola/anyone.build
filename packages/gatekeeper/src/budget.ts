import type { Scope } from "./schemas";

/** Hard per-request caps in cents. Cheap models make these generous. */
export const SCOPE_CAP_CENTS: Record<Scope, number> = { tiny: 20, small: 40, medium: 100, large: 300 };

/** Estimate cost in cents from token usage and $/M prices. */
export function costCents(usage: { inputTokens: number; outputTokens: number }, price: { inPerM: number; outPerM: number }): number {
  const dollars = (usage.inputTokens / 1e6) * price.inPerM + (usage.outputTokens / 1e6) * price.outPerM;
  return Math.ceil(dollars * 100);
}

/** Known list prices ($ per M tokens) for the default models; unknown models fall back to a safe guess. */
export const PRICES: Record<string, { inPerM: number; outPerM: number }> = {
  "z-ai/glm-5.3-flash": { inPerM: 0.075, outPerM: 0.25 },
  "z-ai/glm-5.3": { inPerM: 1.4, outPerM: 4.4 },
  "deepseek/deepseek-v4-flash-0731": { inPerM: 0.065, outPerM: 0.18 },
  "qwen/qwen3.7-flash": { inPerM: 0.03, outPerM: 0.13 },
  "qwen/qwen3-coder-next": { inPerM: 0.12, outPerM: 0.8 },
  "minimax/minimax-m3": { inPerM: 0.3, outPerM: 1.2 },
  "openai/gpt-5-nano": { inPerM: 0.05, outPerM: 0.4 },
  "google/gemini-2.5-flash-lite": { inPerM: 0.1, outPerM: 0.4 },
  "google/gemini-3.1-flash-lite": { inPerM: 0.25, outPerM: 1.5 },
  "google/gemini-2.5-flash": { inPerM: 0.3, outPerM: 2.5 },
  // stronger coders, routed by scope (OpenRouter list prices, 2026-09-03)
  "qwen/qwen3-coder-plus": { inPerM: 0.65, outPerM: 3.25 },
  "anthropic/claude-sonnet-5": { inPerM: 2, outPerM: 10 },
  "openai/gpt-5.1-codex": { inPerM: 1.25, outPerM: 10 },
  "moonshotai/kimi-k2.5": { inPerM: 0.45, outPerM: 2.25 },
};
export function priceFor(model: string) {
  return PRICES[model] ?? { inPerM: 2, outPerM: 8 };
}
