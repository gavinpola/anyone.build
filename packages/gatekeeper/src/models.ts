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

/** Display-limit clamps. Model output is parsed leniently and clamped here, never rejected for length. */
function clampStr(v: unknown, max: number): string {
  return String(v ?? "").slice(0, max);
}
function clampList(v: unknown, max: number, each: number): string[] {
  return (Array.isArray(v) ? v : []).map((x) => clampStr(x, each)).filter((x) => x.trim().length > 0).slice(0, max);
}
function clamp01(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.5;
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
    maxOutputTokens: 4000, // big/ambitious asks need room to plan; 1500 truncated into a parse-fail reject
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
    maxOutputTokens: 2500, // reasoning models spend tokens before answering; 1200 came back empty
    maxRetries: 2,
  });
  const rt = r.object;
  return {
    verdict: { ...rt, harms: clampList(rt.harms, 6, 200), most_likely_intent: clampStr(rt.most_likely_intent, 200), public_hint: clampStr(rt.public_hint, 160), confidence: clamp01(rt.confidence) },
    usage: usageOf(r, cfg.redTeamModel),
  };
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
  const rv = r.object;
  return {
    review: { ...rv, hidden_behavior: clampList(rv.hidden_behavior, 6, 200), safety_concerns: clampList(rv.safety_concerns, 6, 200), summary: clampStr(rv.summary, 140) },
    usage: usageOf(r, cfg.reviewModel),
  };
}

const SCOPE_ORDER = ["tiny", "small", "medium", "large"] as const;
/** Max scope per trust: −1 guest, 0 new, 1 builder, 2 trusted, 3 maintainer. Guests and new accounts can add a small block; medium needs standing. */
// Gavin: "I want people to be able to do stuff — mostly they can just go; big-big changes get voted."
// So medium ships for everyone (money is guarded by per-request caps and the daily budget), large
// ships for trusted people, and only large-from-newcomers goes to the vote board.
const MAX_SCOPE: Record<string, JudgeVerdict["scope"]> = { "-1": "medium", "0": "medium", "1": "medium", "2": "large", "3": "large" };

/**
 * The deterministic trust gate on scope, shared by the real judge, the mock judge, and tests.
 * Guests (−1) may add or edit something small; bigger asks say "sign in". New accounts (0) are
 * tiny-only. Builders (1+) get a human look instead of a no.
 */
export function scopeGate(trust: number, scope: JudgeVerdict["scope"]): { allowed: boolean; needsHuman: boolean; category: "too_big" | null; hint: string } {
  const t = String(Math.min(3, Math.max(-1, trust)));
  const max = MAX_SCOPE[t] ?? "tiny";
  if (SCOPE_ORDER.indexOf(scope) <= SCOPE_ORDER.indexOf(max)) return { allowed: true, needsHuman: false, category: null, hint: "" };
  // Too big to auto-ship for this trust level → it goes up for a vote (setVerdict routes too_big to the board).
  if (trust < 0) return { allowed: false, needsHuman: false, category: "too_big", hint: "This one's a big build — it's up for a vote. Sign in to vote for it." };
  if (trust === 0) return { allowed: false, needsHuman: false, category: "too_big", hint: "This one's a big build — it's up for a vote. Big builds ship straight away once your work stays up." };
  return { allowed: false, needsHuman: false, category: "too_big", hint: "This one's a big build — it's up for a vote." };
}

/** Deterministic guardrails on top of the model's answer. */
export function normalizeJudge(v: JudgeVerdict, input: JudgeInput): JudgeVerdict {
  // Clamp to display limits first: length is never a reason to throw away a verdict.
  const out: JudgeVerdict = {
    ...v,
    public_hint: clampStr(v.public_hint, 160),
    plan: clampList(v.plan, 5, 200),
    rationale: clampStr(v.rationale, 600),
    confidence: clamp01(v.confidence),
    touches_backend: Boolean(v.touches_backend),
    touches_other_blocks: Boolean(v.touches_other_blocks),
  };
  const trust = input.requester.trust;
  // A change to ONE block can't be "large": block files are capped at 400 lines. Models inflate
  // creative asks ("a really cool visual") to large; cap at medium unless it touches other blocks
  // or builds a page (a whole route can legitimately be large).
  const buildsPage = /\bpages?\//i.test(out.plan.join(" ")) || /\b(a|new|whole) page\b/i.test(out.plan.join(" "));
  if (out.scope === "large" && !out.touches_other_blocks && !buildsPage) out.scope = "medium";
  const gate = scopeGate(trust, out.scope);
  if (out.verdict === "approve" && !gate.allowed) {
    out.verdict = "reject";
    out.category = gate.category;
    out.public_hint = gate.hint;
  }
  // A concrete, in-scope plan from a trusted-enough requester shouldn't die on the model's hedge:
  // promote it to approve (the red team, security pass, and validator still gate the actual build).
  if (out.verdict === "needs_human" && out.plan.length >= 2 && scopeGate(trust, out.scope).allowed) {
    out.verdict = "approve";
    if (/too big|can't|cannot|unsure|maintainer|not sure/i.test(out.public_hint)) out.public_hint = "On it. This is a big one, so give it a minute.";
  }
  // Size is scope, never a verdict. If the model rejected or hedged *because the ask is big*
  // ("a big project; ask for something smaller"), it ignored the ambition rule: route it to the vote
  // board as a large, honestly-scoped proposal instead of a dead reject.
  const sizeTalk = /\b(big project|too big|too large|large project|too complex|too ambitious|ambitious|smaller|scope (it )?down|more specific|whole app|entire (app|game|site)|full (app|game))\b/i;
  const hedged = (out.verdict === "reject" && (out.category === "unclear" || !out.category)) || out.verdict === "needs_human";
  if (hedged && (sizeTalk.test(out.public_hint) || sizeTalk.test(out.rationale))) {
    out.verdict = "reject";
    out.category = "too_big";
    if (SCOPE_ORDER.indexOf(out.scope) < SCOPE_ORDER.indexOf("large")) out.scope = "large";
    if (out.plan.length === 0) out.plan = ["Build the smallest honest version of what was asked, as its own page, with the kit's useTick loop and a canvas if it's a game."];
    out.public_hint = "This one's big — it's up for a vote.";
  }
  // An unsure hedge that still produced a concrete plan is a big/ambiguous ask, not noise: mark it
  // too_big so it routes to the proposals board (up for a vote), not a dead reject. Only a hedge with
  // no plan is a genuine "nothing to build" → unclear.
  if (out.verdict === "needs_human") {
    out.verdict = "reject";
    out.category = out.plan.length >= 2 ? "too_big" : "unclear";
  }
  if (out.touches_backend && out.verdict === "approve") {
    if (trust < 1) {
      out.verdict = "reject";
      out.category = "too_big";
      out.public_hint = "That needs a room function — it'll go up for a vote.";
    } else if (out.scope === "tiny") out.scope = "small";
  }
  const VALID = new Set(["not_for_everyone","destroys_others_work","unsafe_code","out_of_bounds","unclear","too_big","collided","budget_spent","slow_down","build_failed"]);
  if (out.verdict === "reject" && (!out.category || !VALID.has(out.category))) out.category = "unclear";
  if (out.verdict !== "reject") out.category = null;
  if (out.verdict === "approve" && out.plan.length === 0) {
    out.verdict = "reject";
    out.category = "unclear";
    out.public_hint = "Couldn't turn that into concrete steps. Say what should change, and where.";
  }
  // Never let a hint leak the machinery
  if (/constitution|system prompt|instruction|judge|gatekeeper|ask a human|human for help|a maintainer|maintainer will|too complex for automatic/i.test(out.public_hint)) {
    // No human queue exists: never tell the requester to ask one. Give a clean, on-brand line.
    out.public_hint =
      out.verdict === "approve"
        ? "Looks good for everyone."
        : out.category === "too_big"
          ? "This one's big — it'll go up for a vote."
          : out.category === "out_of_bounds"
            ? "Only the wall itself can change, not the machinery behind it."
            : "That one doesn't quite fit the wall's rules. Try saying it a different way.";
  }
  return out;
}

export const NoteTriage = z.object({
  kind: z.enum(["bug", "copy", "design", "feature", "question", "spam"]),
  summary: z.string(),
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
  return { triage: { ...r.object, summary: clampStr(r.object.summary, 160) }, usage: usageOf(r, cfg.model) };
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
  return { review: { ...r.object, findings: clampList(r.object.findings, 6, 240), summary: clampStr(r.object.summary, 160) }, usage: usageOf(r, model) };
}

/**
 * Resource-only findings (growth, flooding, spam volume, missing limits) are the server's job: the kit
 * caps storage and rate-limits writes. They are notes, never a reason to fail a build. Production
 * regression: a collaborative art block was failed for "unbounded growth of the collection".
 */
const RESOURCE_WORDS = /\b(unbounded|without (a )?(bound|limit|cap)|grow(s|th|ing)?|flood(s|ing)?|rate[- ]?limit(s|ing|ed)?|too many|large number|exhaust(s|ion|ing)?|spam(ming)?|denial of service|dos|quota|storage|prun(e|ing)|limit the number|access control(s)?)\b/i;
const HARM_WORDS = /\b(exfil\w*|leak\w*|steal\w*|track\w*|fingerprint\w*|secret\w*|token\w*|password\w*|credential\w*|phish\w*|decei\w*|deception|imperson\w*|inject\w*|hidden|obfusc\w*|encod\w*|keystroke\w*|typed|types|record(s|ed|ing)?|per[- ]visitor|personal|private|pii|email\w*|other (people|user|visitor)s?'?|overwrit\w*|delet\w*|remov\w*|expos\w*|ignore previous|system:|url\w*|link\w*|navigat\w*)\b/i;
export function resourceOnly(findings: string[]): boolean {
  return findings.length > 0 && findings.every((f) => RESOURCE_WORDS.test(f) && !HARM_WORDS.test(f));
}

/** Medium or high risk never ships, whatever the model's block flag says, unless every finding is resource-only. */
export function securityBlocks(review: SecurityReview): boolean {
  if (resourceOnly(review.findings)) return false;
  return review.block || review.risk === "medium" || review.risk === "high";
}
