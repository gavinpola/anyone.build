import { judge } from "./models";
import type { JudgeVerdict } from "./schemas";
import type { ModelConfig, Usage } from "./models";
import type { JudgeInput } from "./prompts/judge";
import { costCents, priceFor } from "./budget";

/**
 * The judge as the pipeline actually runs it: a retry chain across vendors, then up to two cheap
 * "second looks" that catch the model hedging where the methodology says it shouldn't
 * (docs/WHAT-SHIPS.md). Lives here so the pipeline (convex/pipeline/judge.ts) and the eval
 * (packages/gatekeeper/evals) measure the same behaviour.
 */
export const BACKEND_OFF_ADDENDUM =
  "Room functions (backend) are switched off right now: plan shared state with the kit store (useStore/useCounter) whenever the ask can be met that way, and set touches_backend=true only if it truly can't.";

export type JudgeFn = (cfg: ModelConfig, input: JudgeInput) => Promise<{ verdict: JudgeVerdict; usage: Usage }>;

export type JudgeRunOptions = {
  /** Room functions usable for this request (tier on AND requester may use them). */
  backendAvailable: boolean;
  /** Where attempt failures and second looks are logged. */
  log?: (message: string) => void;
  /** Test seam. */
  judgeFn?: JudgeFn;
};

export type JudgeRunResult = { verdict: JudgeVerdict; cents: number; calls: number; secondLooks: string[] };

export async function judgeWithSecondLooks(cfg: ModelConfig, input: JudgeInput, opts: JudgeRunOptions): Promise<JudgeRunResult> {
  const run = opts.judgeFn ?? judge;
  const log = opts.log ?? (() => {});
  let cents = 0;
  let calls = 0;
  const secondLooks: string[] = [];
  const call = async (c: ModelConfig) => {
    calls++;
    const r = await run(c, input);
    cents += costCents(r.usage, priceFor(c.judgeModel));
    return r.verdict;
  };

  // Retry once, then try the other vendor. Log every attempt's error: a swallowed retry chain once
  // hid a schema bug for a day.
  const attempt = (label: string, c: ModelConfig) =>
    call(c).catch((e: unknown) => {
      log(`judge attempt failed [${label} ${c.judgeModel}]: ${e instanceof Error ? e.message.slice(0, 400) : String(e)}`);
      throw e;
    });
  let first = await attempt("1", cfg)
    .catch(() => attempt("2", cfg))
    .catch(() => attempt("3/fallback", { ...cfg, judgeModel: cfg.redTeamModel }));

  const withNudge = (nudge: string): ModelConfig => ({ ...cfg, addendum: [cfg.addendum, nudge].filter(Boolean).join("\n") });

  // "Unclear" on an ask that has a target and some words is usually the model being lazy, not the ask
  // being empty; and a change to ONE block is at most medium, which ships for everyone, so "too big"
  // there is the model hedging. One generous second look before anyone gets bounced.
  const singleBlock = Boolean(input.target.blockId) && input.target.blockId !== "__new__" && !first.touches_other_blocks;
  const enoughWords = input.prompt.trim().split(/\s+/).length >= 4;
  const lazyUnclear = first.verdict === "reject" && first.category === "unclear" && enoughWords;
  const bigOneBlock = first.verdict === "reject" && first.category === "too_big" && singleBlock && !first.touches_backend;
  if (lazyUnclear || bigOneBlock) {
    try {
      const nudge = bigOneBlock
        ? `SECOND LOOK: this ask targets ONE existing block (${input.target.blockId}). Changing one block is at most a medium change, and medium ships for everyone here, so size is never a reason to hedge. Pick the most reasonable concrete interpretation (for "split into two halves", a two-column layout inside the block), write a 2-5 step plan, scope it tiny/small/medium honestly, and approve unless it breaks a rule.`
        : "SECOND LOOK: this ask has a target and a direction. Do not ask for more detail. Pick the most reasonable concrete interpretation, write it as a 2-5 step plan, size it honestly, and approve unless it breaks a rule.";
      secondLooks.push(bigOneBlock ? "one-block too_big" : "lazy unclear");
      const again = await call(withNudge(nudge));
      if (again.verdict === "approve" || (again.verdict === "reject" && again.category !== "unclear" && again.category !== "too_big")) first = again;
    } catch (e) {
      log(`generous retry failed: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}`);
    }
  }

  // Room functions unavailable: most shared state fits the kit store, so one chance to re-plan without
  // a backend before this goes to a vote.
  if (first.touches_backend && !opts.backendAvailable && (first.verdict === "approve" || first.category === "too_big")) {
    try {
      secondLooks.push("kit-store re-plan");
      const again = await call(
        withNudge(
          "SECOND LOOK: room functions are NOT available for this request. Re-plan it using only the kit store (useStore for a shared list of small documents, useCounter for a shared tally; both live for everyone) and set touches_backend=false, unless the ask truly needs server-side rules (strict one-per-person, hidden state, atomic turn-taking). Approve the kit-store version.",
        ),
      );
      if (again.verdict === "approve" && !again.touches_backend) first = again;
    } catch (e) {
      log(`backend re-plan failed: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}`);
    }
  }

  return { verdict: first, cents, calls, secondLooks };
}
