"use node";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { judge, redTeam, costCents, priceFor, scopeGate, type JudgeInput, type ModelConfig } from "../../packages/gatekeeper/src/index";
import { fetchManifest, fetchSnippet } from "./source";

export const run = internalAction({
  args: { requestId: v.id("requests") },
  handler: async (ctx, { requestId }) => {
    const data = await ctx.runQuery(internal.requests.getInternal, { id: requestId });
    if (!data || data.request.status !== "judging") return;
    const { request, user, guest } = data;
    const requester = user
      ? { handle: user.handle, trust: user.trust, liveChanges: user.liveChanges }
      : { handle: guest?.handle ?? "guest", trust: -1, liveChanges: 0 };
    const config = await ctx.runQuery(internal.config.all, {});

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey && process.env.MOCK_JUDGE === "1") {
      // Local dev without a model: a few keyword rules so the whole loop can be exercised.
      const p = request.prompt.toLowerCase();
      const bad =
        /(https?:\/\/|\.com\b|\.io\b|buy|discount|promo|follow me)/.test(p) ? ("not_for_everyone" as const)
        : /(delete everything|remove all|wipe|nuke)/.test(p) ? ("destroys_others_work" as const)
        : /(script|iframe|track|cookie|fetch|api key|secret|convex)/.test(p) ? ("unsafe_code" as const)
        : null;
      const scope = request.target.path.endsWith("/") ? ("small" as const) : ("tiny" as const);
      const gate = scopeGate(requester.trust, scope);
      const res = await ctx.runMutation(internal.requests.setVerdict, {
        id: requestId,
        approved: !bad && gate.allowed,
        needsHuman: !bad && !gate.allowed && gate.needsHuman,
        category: bad ?? (gate.allowed ? undefined : (gate.category ?? undefined)),
        hint: bad ? "That one doesn't fit the wall's rules." : gate.allowed ? "Looks good for everyone." : gate.hint,
        scope,
        confidence: 0.9,
        plan: [request.target.path.endsWith("/") ? "Create a new block that does what was asked." : `Edit ${request.target.path} near line ${request.target.line} as asked.`],
        redTeamed: false,
        model: "mock",
        capCents: config.scopeCapsCents[scope],
      });
      if (res?.queued) await ctx.runMutation(internal.pipeline.executor.enqueue, { requestId });
      return;
    }
    if (!apiKey) {
      // No judge configured: fail closed, but tell the requester something useful.
      await ctx.runMutation(internal.requests.setVerdict, {
        id: requestId, approved: false, needsHuman: true, hint: "The judge isn't set up yet; a maintainer will look.", scope: "tiny", confidence: 0, plan: [], redTeamed: false, model: "none", capCents: 0,
      });
      return;
    }

    const cfg: ModelConfig = {
      apiKey,
      baseURL: process.env.MODEL_BASE_URL || undefined,
      judgeModel: process.env.JUDGE_MODEL || config.judgeModel,
      redTeamModel: process.env.REDTEAM_MODEL || config.redTeamModel,
      reviewModel: process.env.REVIEW_MODEL || config.reviewModel,
      addendum: process.env.JUDGE_ADDENDUM || undefined,
    };

    const [manifest, snippet, recentChanges] = await Promise.all([
      fetchManifest(request.roomId),
      fetchSnippet(request.target.path, request.target.line),
      ctx.runQuery(internal.requests.recentChanges, { roomId: request.roomId, limit: 20 }),
    ]);

    const input: JudgeInput = {
      prompt: request.prompt,
      target: request.target,
      snippet,
      manifest: manifest.blocks,
      pages: manifest.pages,
      recentChanges,
      requester,
      addendum: cfg.addendum,
    };

    let first;
    let judgeCents = 0;
    try {
      // One retry: cheap models occasionally return JSON the schema can't parse.
      const j = await judge(cfg, input).catch(() => judge(cfg, input));
      first = j.verdict;
      judgeCents += costCents(j.usage, priceFor(cfg.judgeModel));
    } catch (e) {
      await ctx.runMutation(internal.requests.setVerdict, {
        id: requestId, approved: false, needsHuman: true, hint: "The judge stumbled; a maintainer will look.", scope: "tiny", confidence: 0, plan: [], redTeamed: false, model: cfg.judgeModel, capCents: 0,
      });
      console.error("judge failed", e);
      return;
    }

    let approved = first.verdict === "approve";
    let needsHuman = first.verdict === "needs_human";
    let category = first.category ?? undefined;
    let hint = first.public_hint;
    let redTeamed = false;
    const order = ["tiny", "small", "medium", "large"];
    const risky = /(link|url|http|image|img|form|login|auth|password|email|money|pay|crypto|track|script|iframe|admin|rule)/i.test(request.prompt);
    if (approved && (first.confidence < config.redTeamConfidenceBelow || order.indexOf(first.scope) >= 2 || risky)) {
      redTeamed = true;
      try {
        const rtRes = await redTeam(cfg, input, first);
        judgeCents += costCents(rtRes.usage, priceFor(cfg.redTeamModel));
        const rt = rtRes.verdict;
        if (rt.block) {
          approved = false;
          needsHuman = rt.confidence < 0.6;
          category = rt.category ?? "unsafe_code";
          hint = rt.public_hint || hint;
        }
      } catch (e) {
        console.error("red team failed", e);
        approved = false;
        needsHuman = true;
        hint = "Needs a second look from a maintainer.";
      }
    }

    const capCents = config.scopeCapsCents[first.scope];
    const res = await ctx.runMutation(internal.requests.setVerdict, {
      id: requestId,
      approved,
      needsHuman,
      category: approved ? undefined : category,
      hint,
      scope: first.scope,
      confidence: first.confidence,
      plan: first.plan,
      redTeamed,
      model: cfg.judgeModel,
      capCents,
      judgeCents,
    });
    if (res?.queued) await ctx.runMutation(internal.pipeline.executor.enqueue, { requestId });
  },
});
