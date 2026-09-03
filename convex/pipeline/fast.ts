"use node";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import {
  fastSystemPrompt,
  fastUserPrompt,
  extractRewrite,
  fastRewrite,
  unifiedDiff,
  reviewDiff,
  securityReview,
  securityBlocks,
  resourceOnly,
  validateDiff,
  costCents,
  priceFor,
  type ModelConfig,
} from "../../packages/gatekeeper/src/index";
import { octokit, headSha, fileAt, commitFiles, openPullRequest } from "./github";

const MAX_BLOCK_LINES = 400;

/**
 * The fast path: a tiny change to one existing file, made in one model call with no sandbox.
 * Same validator, same diff review, same security pass, same PR; CI is the typecheck.
 * Returns handled=false (and puts the request back in the queue) whenever the reply is unusable,
 * so the sandbox takes over and nothing that used to ship stops shipping.
 */
export const run = internalAction({
  args: { requestId: v.id("requests") },
  handler: async (ctx, { requestId }): Promise<{ handled: boolean; reason?: string }> => {
    const data = await ctx.runQuery(internal.requests.getInternal, { id: requestId });
    if (!data || data.request.status !== "queued" || !data.request.verdict) return { handled: false, reason: "not queued" };
    const { request, user, guest } = data;
    const verdict = request.verdict;
    if (!verdict) return { handled: false, reason: "no verdict" };
    const requesterHandle = user?.handle ?? guest?.handle ?? "a guest";
    const config = await ctx.runQuery(internal.config.all, {});
    const modelKey = process.env.OPENROUTER_API_KEY;
    if (!modelKey) return { handled: false, reason: "no model key" };
    const model = process.env.FAST_MODEL || config.fastModel || config.coderModel;
    const path = request.target.path;

    class Aborted extends Error {}
    const set = async (status: "building" | "validating" | "reviewing" | "preview", stage?: string, run?: Record<string, unknown>) => {
      const res = await ctx.runMutation(internal.requests.setStatus, { id: requestId, status, stage, run });
      if (!res.ok) throw new Aborted(`request is ${res.status ?? "gone"}`);
    };
    const fail = (category: string, hint: string, error: string, cost: number) =>
      ctx.runMutation(internal.pipeline.state.fail, { id: requestId, category, hint, error, costCents: cost });
    const back = async (reason: string, cost: number): Promise<{ handled: false; reason: string }> => {
      console.log(`fast path → sandbox: ${reason}`);
      await ctx.runMutation(internal.pipeline.state.requeue, { id: requestId, costCents: cost });
      return { handled: false, reason };
    };

    let cost = 0;
    try {
      const kit = await octokit();
      const baseSha = await headSha(kit);
      const source = await fileAt(kit, path, baseSha);
      if (!source) return back("no source", 0);
      if (source.split("\n").length > MAX_BLOCK_LINES) return back("file too long", 0);

      await set("building", "fast path · rewriting one file", { startedAt: Date.now() });
      const cfg: ModelConfig = {
        apiKey: modelKey,
        baseURL: process.env.MODEL_BASE_URL || undefined,
        judgeModel: config.judgeModel,
        redTeamModel: config.redTeamModel,
        reviewModel: process.env.REVIEW_MODEL || config.reviewModel,
        securityModel: process.env.SECURITY_MODEL || config.securityModel,
      };
      const out = await fastRewrite(cfg, { model, system: fastSystemPrompt(), prompt: fastUserPrompt({ prompt: request.prompt, plan: verdict.plan, target: request.target, source }) });
      cost += costCents(out.usage, priceFor(model));
      const rw = extractRewrite(out.text);
      if (!rw) return back("no file in the reply", cost);
      if (rw.content === source) return back("no change", cost);
      if (rw.content.split("\n").length > MAX_BLOCK_LINES) return back("rewrite too long", cost);
      const diff = unifiedDiff(path, source, rw.content);
      if (!diff) return back("empty diff", cost);

      await set("validating", "checking the diff", { filesTouched: [path] });
      const fullFiles = { [path]: rw.content };
      const validation = validateDiff(diff, verdict.scope, { fullFiles, allowBackend: false });
      if (!validation.ok) return back("validator: " + validation.problems.join("; ").slice(0, 200), cost);

      await set("reviewing", "second opinion on the diff");
      const { review, usage } = await reviewDiff(cfg, { prompt: request.prompt, plan: verdict.plan, diff });
      cost += costCents(usage, priceFor(cfg.reviewModel));
      if (review.safety_concerns.length) {
        await fail("unsafe_code", "The reviewer wasn't comfortable with that diff.", [...review.safety_concerns, ...review.hidden_behavior].join("; "), cost);
        return { handled: true, reason: "review: safety" };
      }
      if (!review.approve || !review.matches_request) return back("review: " + (review.hidden_behavior.join("; ") || "didn't match the request"), cost);

      await set("reviewing", "security review");
      const sec = await securityReview(cfg, { prompt: request.prompt, plan: verdict.plan, diff, fullFiles });
      cost += costCents(sec.usage, priceFor(cfg.securityModel || cfg.reviewModel));
      const resourceNotes = resourceOnly(sec.review.findings) && (sec.review.block || sec.review.risk === "medium" || sec.review.risk === "high");
      if (securityBlocks(sec.review)) {
        await fail("unsafe_code", "The security review flagged that change.", `${sec.review.risk}: ${sec.review.findings.join("; ") || sec.review.summary}`, cost);
        return { handled: true, reason: "security" };
      }

      await set("building", "opening pull request");
      const branch = `playground/${requestId}`;
      const coauthor = user ? { name: user.handle, email: `${user.id}+${user.handle}@users.noreply.github.com` } : undefined;
      const summary = review.summary || rw.summary || "A tiny change.";
      const headShaNew = await commitFiles(kit, { baseSha, branch, files: { [path]: rw.content }, message: summary, coauthor });
      const pr = await openPullRequest(kit, {
        branch,
        title: summary,
        body: [
          `**Request** by ${user ? "@" + user.handle : requesterHandle}: ${request.prompt}`,
          ``,
          `**Plan**`,
          ...verdict.plan.map((p) => `- ${p}`),
          ``,
          `Scope: tiny · fast path (one model call, no sandbox; CI is the typecheck) · cost: $${(cost / 100).toFixed(2)} · security: ${sec.review.risk}${resourceNotes ? " (resource-only notes; the kit caps storage)" : ""}${sec.review.findings.length ? " (" + sec.review.findings.join("; ").slice(0, 300) + ")" : ""}`,
          ``,
          `Opened automatically by anyone.build.`,
        ].join("\n"),
        labels: ["playground"],
      });
      await set("preview", undefined, {
        branch,
        baseSha,
        headSha: headShaNew,
        prNumber: pr.number,
        prUrl: pr.url,
        summary,
        filesTouched: validation.files.map((f) => f.path),
        linesAdded: validation.added,
        linesRemoved: validation.removed,
        blockIds: validation.blockIds,
        securityRisk: sec.review.risk,
        costCents: cost,
        turns: 1,
      });
      await ctx.scheduler.runAfter(90_000, internal.pipeline.github.tryMerge, { requestId });
      return { handled: true };
    } catch (e) {
      if (e instanceof Aborted) return { handled: true, reason: "cancelled" };
      // Anything unexpected on the fast path is a reason to use the sandbox, never to fail the ask.
      const msg = e instanceof Error ? e.message : String(e);
      return back("error: " + msg.slice(0, 200), cost);
    }
  },
});
