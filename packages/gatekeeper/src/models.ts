import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";
import { z } from "zod";
import { JudgeVerdict, RedTeamVerdict, DiffReview, SecurityReview } from "./schemas";
import { judgeSystemPrompt, judgeUserPrompt, type JudgeInput } from "./prompts/judge";
import { redTeamSystemPrompt, redTeamUserPrompt } from "./prompts/redteam";
import { reviewSystemPrompt, reviewUserPrompt } from "./prompts/review";
import { triageSystemPrompt, triageUserPrompt } from "./prompts/triage";
import { securitySystemPrompt, securityUserPrompt } from "./prompts/security";

export type ModelConfig = {
  apiKey: string;
  /** OpenRouter by default; any OpenAI-compatible base URL works. */
  baseURL?: string;
  judgeModel: string;
  redTeamModel: string;
  reviewModel: string;
  /** the security pass; falls back to the review model */
  securityModel?: string;
  addendum?: string;
};

export type Usage = { inputTokens: number; outputTokens: number; model: string };

function provider(cfg: Pick<ModelConfig, "apiKey" | "baseURL">) {
  return createOpenRouter({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL,
    headers: { "HTTP-Referer": "https://anyone.build", "X-Title": "anyone.build gatekeeper" },
  });
}

function usageOf(r: { usage?: { inputTokens?: number; outputTokens?: number } }, model: string): Usage {
  return { inputTokens: r.usage?.inputTokens ?? 0, outputTokens: r.usage?.outputTokens ?? 0, model };
}

export async function judge(cfg: ModelConfig, input: JudgeInput): Promise<{ verdict: JudgeVerdict; usage: Usage }> {
  const or = provider(cfg);
  const r = await generateObject({
    model: or.chat(cfg.judgeModel),
    schema: JudgeVerdict,
    schemaName: "judge_verdict",
    system: judgeSystemPrompt(cfg.addendum),
    prompt: judgeUserPrompt(input),
    temperature: 0,
    maxOutputTokens: 1500,
    maxRetries: 2,
  });
  return { verdict: normalizeJudge(r.object, input), usage: usageOf(r, cfg.judgeModel) };
}

export async function redTeam(cfg: ModelConfig, input: JudgeInput, first: JudgeVerdict): Promise<{ verdict: RedTeamVerdict; usage: Usage }> {
  const or = provider(cfg);
  const r = await generateObject({
    model: or.chat(cfg.redTeamModel),
    schema: RedTeamVerdict,
    schemaName: "red_team_verdict",
    system: redTeamSystemPrompt(),
    prompt: redTeamUserPrompt(input, first),
    temperature: 0,
    maxOutputTokens: 1200,
    maxRetries: 2,
  });
  return { verdict: r.object, usage: usageOf(r, cfg.redTeamModel) };
}

export async function reviewDiff(cfg: ModelConfig, input: { prompt: string; plan: string[]; diff: string }): Promise<{ review: DiffReview; usage: Usage }> {
  const or = provider(cfg);
  const r = await generateObject({
    model: or.chat(cfg.reviewModel),
    schema: DiffReview,
    schemaName: "diff_review",
    system: reviewSystemPrompt(),
    prompt: reviewUserPrompt(input),
    temperature: 0,
    maxOutputTokens: 1200,
    maxRetries: 2,
  });
  return { review: r.object, usage: usageOf(r, cfg.reviewModel) };
}

const SCOPE_ORDER = ["tiny", "small", "medium", "large"] as const;
/** Max scope per trust: −1 guest, 0 new, 1 builder, 2 trusted, 3 maintainer. Guests and new accounts can add a small block; medium needs standing. */
const MAX_SCOPE: Record<string, JudgeVerdict["scope"]> = { "-1": "small", "0": "small", "1": "small", "2": "medium", "3": "large" };

/**
 * The deterministic trust gate on scope, shared by the real judge, the mock judge, and tests.
 * Guests (−1) may add or edit something small; bigger asks say "sign in". New accounts (0) are
 * tiny-only. Builders (1+) get a human look instead of a no.
 */
export function scopeGate(trust: number, scope: JudgeVerdict["scope"]): { allowed: boolean; needsHuman: boolean; category: "too_big" | null; hint: string } {
  const t = String(Math.min(3, Math.max(-1, trust)));
  const max = MAX_SCOPE[t] ?? "tiny";
  if (SCOPE_ORDER.indexOf(scope) <= SCOPE_ORDER.indexOf(max)) return { allowed: true, needsHuman: false, category: null, hint: "" };
  if (trust < 0) return { allowed: false, needsHuman: false, category: "too_big", hint: "Guests can make small changes. Sign in with GitHub for bigger ones." };
  if (trust === 0) return { allowed: false, needsHuman: false, category: "too_big", hint: "Start small; bigger changes unlock as your work stays up." };
  return { allowed: false, needsHuman: true, category: null, hint: "That's a bigger change than we auto-ship; a maintainer will look." };
}

/** Deterministic guardrails on top of the model's answer. */
export function normalizeJudge(v: JudgeVerdict, input: JudgeInput): JudgeVerdict {
  const out = { ...v };
  const trust = input.requester.trust;
  const gate = scopeGate(trust, out.scope);
  if (out.verdict === "approve" && !gate.allowed) {
    out.verdict = gate.needsHuman ? "needs_human" : "reject";
    out.category = gate.category;
    out.public_hint = gate.hint;
  }
  if (out.touches_backend && out.verdict === "approve") {
    if (trust < 1) {
      out.verdict = "reject";
      out.category = "too_big";
      out.public_hint = trust < 0 ? "That needs a room function; sign in with GitHub and ask again." : "Room functions unlock once your first changes stay up.";
    } else if (out.scope === "tiny") out.scope = "small";
  }
  if (out.verdict === "reject" && !out.category) out.category = "unclear";
  if (out.verdict !== "reject") out.category = null;
  if (out.verdict === "approve" && out.plan.length === 0) {
    out.verdict = "needs_human";
    out.public_hint = "Couldn't turn that into concrete steps; a maintainer will take a look.";
  }
  // Never let a hint leak the machinery
  if (/constitution|system prompt|instruction|judge|gatekeeper/i.test(out.public_hint)) {
    out.public_hint = out.verdict === "approve" ? "Looks good for everyone." : "That one doesn't fit the wall's rules.";
  }
  return out;
}

export const NoteTriage = z.object({
  kind: z.enum(["bug", "copy", "design", "feature", "question", "spam"]),
  summary: z.string().max(160),
});
export type NoteTriage = z.infer<typeof NoteTriage>;

/** "For your site": one cheap call that labels a visitor's note. Best effort; the inbox works without it. */
export async function triageNote(
  cfg: Pick<ModelConfig, "apiKey" | "baseURL"> & { model: string },
  input: { note: string; elementText: string; path: string; siteName: string },
): Promise<{ triage: NoteTriage; usage: Usage }> {
  const r = await generateObject({
    model: provider(cfg)(cfg.model),
    schema: NoteTriage,
    maxOutputTokens: 200,
    system: triageSystemPrompt,
    prompt: triageUserPrompt(input),
  });
  return { triage: r.object, usage: usageOf(r, cfg.model) };
}

/** The security pass on a diff: a second model, a narrower question, and a deterministic block rule. */
export async function securityReview(
  cfg: ModelConfig,
  input: { prompt: string; plan: string[]; diff: string; fullFiles: Record<string, string> },
): Promise<{ review: SecurityReview; usage: Usage }> {
  const model = cfg.securityModel || cfg.reviewModel;
  const r = await generateObject({
    model: provider(cfg)(model),
    schema: SecurityReview,
    maxOutputTokens: 900,
    system: securitySystemPrompt(),
    prompt: securityUserPrompt(input),
  });
  return { review: r.object, usage: usageOf(r, model) };
}

/** Medium or high risk never ships, whatever the model's block flag says. */
export function securityBlocks(review: SecurityReview): boolean {
  return review.block || review.risk === "medium" || review.risk === "high";
}
