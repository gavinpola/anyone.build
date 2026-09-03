import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";
import { JudgeVerdict, RedTeamVerdict, DiffReview } from "./schemas";
import { judgeSystemPrompt, judgeUserPrompt, type JudgeInput } from "./prompts/judge";
import { redTeamSystemPrompt, redTeamUserPrompt } from "./prompts/redteam";
import { reviewSystemPrompt, reviewUserPrompt } from "./prompts/review";

export type ModelConfig = {
  apiKey: string;
  /** OpenRouter by default; any OpenAI-compatible base URL works. */
  baseURL?: string;
  judgeModel: string;
  redTeamModel: string;
  reviewModel: string;
  addendum?: string;
};

export type Usage = { inputTokens: number; outputTokens: number; model: string };

function provider(cfg: ModelConfig) {
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
    maxRetries: 2,
  });
  return { review: r.object, usage: usageOf(r, cfg.reviewModel) };
}

/** Deterministic guardrails on top of the model's answer. */
export function normalizeJudge(v: JudgeVerdict, input: JudgeInput): JudgeVerdict {
  const out = { ...v };
  const trust = input.requester.trust;
  // Trust gates on scope
  const maxScope: Record<number, JudgeVerdict["scope"]> = { 0: "tiny", 1: "small", 2: "medium", 3: "large" };
  const order = ["tiny", "small", "medium", "large"] as const;
  const allowed = maxScope[Math.min(3, Math.max(0, trust))] ?? "tiny";
  if (out.verdict === "approve" && order.indexOf(out.scope) > order.indexOf(allowed)) {
    out.verdict = trust >= 1 ? "needs_human" : "reject";
    out.category = trust >= 1 ? null : "too_big";
    out.public_hint = trust >= 1 ? "That's a bigger change than we auto-ship; a maintainer will look." : "Start with something small; bigger changes unlock as your work stays up.";
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
