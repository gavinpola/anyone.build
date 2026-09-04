"use node";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { judgeWithSecondLooks, BACKEND_OFF_ADDENDUM, redTeam, costCents, priceFor, scopeGate, type JudgeInput, type ModelConfig } from "../../packages/gatekeeper/src/index";
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
        needsHuman: false,
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
        id: requestId, approved: false, needsHuman: false, category: "unclear", hint: "The judge isn't set up yet. Try again later.", scope: "tiny", confidence: 0, plan: [], redTeamed: false, model: "none", capCents: 0,
      });
      return;
    }

    const cfg: ModelConfig = {
      apiKey,
      baseURL: process.env.MODEL_BASE_URL || undefined,
      judgeModel: process.env.JUDGE_MODEL || config.judgeModel,
      redTeamModel: process.env.REDTEAM_MODEL || config.redTeamModel,
      reviewModel: process.env.REVIEW_MODEL || config.reviewModel,
      addendum:
        [
          process.env.JUDGE_ADDENDUM,
          !config.backendEnabled ? BACKEND_OFF_ADDENDUM : "",
        ]
          .filter(Boolean)
          .join("\n") || undefined,
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
      // The judge as the methodology says to run it: retries across vendors, then the second looks
      // (packages/gatekeeper/src/judge-run.ts; the eval measures the same code).
      const r = await judgeWithSecondLooks(cfg, input, { backendAvailable: Boolean(config.backendEnabled) && requester.trust >= 1, log: (m) => console.error(m) });
      first = r.verdict;
      judgeCents += r.cents;
      if (r.secondLooks.length) console.log("judge second looks:", r.secondLooks.join(", "), "→", first.verdict, first.category ?? "");
    } catch (e) {
      await ctx.runMutation(internal.requests.setVerdict, {
        id: requestId, approved: false, needsHuman: false, category: "unclear", hint: "The judge couldn't read that one. Try again in a minute, or say it more plainly.", scope: "tiny", confidence: 0, plan: [], redTeamed: false, model: cfg.judgeModel, capCents: 0,
      });
      console.error("judge failed", e);
      return;
    }
    // There is no human queue: a verdict is approve or reject (and a too_big reject is a proposal).
    let approved = first.verdict === "approve";
    const needsHuman = false;
    // normalizeJudge guarantees category is null or a valid RejectionCategory; narrow for setVerdict.
    let category = (first.category ?? undefined) as
      | "not_for_everyone" | "destroys_others_work" | "unsafe_code" | "out_of_bounds" | "unclear" | "too_big" | "collided" | "budget_spent" | "slow_down" | "build_failed" | undefined;
    let hint = first.public_hint;
    if (approved && first.touches_backend && !config.backendEnabled) {
      approved = false;
      category = "too_big";
      hint = "That needs a room function, which isn't open yet. Ask for the part that doesn't need one.";
    }
    let redTeamed = false;
    const order = ["tiny", "small", "medium", "large"];
    const risky = /(link|url|http|image|img|form|login|auth|password|email|money|pay|crypto|track|script|iframe|admin|rule|backend|save|store|per user|per person|once|schedule)/i.test(request.prompt) || first.touches_backend;
    if (approved && (first.confidence < config.redTeamConfidenceBelow || order.indexOf(first.scope) >= 2 || risky)) {
      redTeamed = true;
      try {
        const rtRes = await redTeam(cfg, input, first);
        judgeCents += costCents(rtRes.usage, priceFor(cfg.redTeamModel));
        const rt = rtRes.verdict;
        // The red team judges harm. Only a real harm category may veto; a block that just says
        // "unclear"/"too_big" is the model overreaching (size and clarity are the judge's call).
        const HARM = new Set(["unsafe_code", "not_for_everyone", "destroys_others_work", "out_of_bounds"]);
        if (rt.block && (rt.category === null || rt.category === undefined || HARM.has(rt.category))) {
          approved = false;
          category = (rt.category as typeof category) ?? "unsafe_code";
          hint = rt.public_hint || hint;
        } else if (rt.block) {
          console.warn("red team block ignored (non-harm category):", rt.category);
        }
      } catch (e) {
        console.error("red team failed", e);
        approved = false;
        category = "unclear";
        hint = "Couldn't get a second opinion on that one. Try again in a minute.";
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
      touchesBackend: first.touches_backend,
    });
    if (res?.queued) await ctx.runMutation(internal.pipeline.executor.enqueue, { requestId });
  },
});
