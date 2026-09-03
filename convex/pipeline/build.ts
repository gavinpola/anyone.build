"use node";
import { Sandbox } from "@vercel/sandbox";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { coderSystemPrompt, coderUserPrompt, reviewDiff, validateDiff, costCents, priceFor, type ModelConfig } from "../../packages/gatekeeper/src/index";
import { octokit, headSha, commitFiles, openPullRequest } from "./github";

type RunnerResult = { ok: boolean; summary: string; files: string[]; steps: number; inputTokens: number; outputTokens: number; checks: Record<string, boolean>; error?: string };

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing env ${name}`);
  return v;
}

/**
 * The real executor. One request → one locked-down sandbox → one PR.
 * No secret enters the sandbox: the OpenRouter key is injected by the firewall; GitHub is only
 * touched from here, after the diff passed the deterministic validator and the diff review.
 */
export const run = internalAction({
  args: { requestId: v.id("requests") },
  handler: async (ctx, { requestId }) => {
    const data = await ctx.runQuery(internal.requests.getInternal, { id: requestId });
    if (!data || !data.user || data.request.status !== "queued" || !data.request.verdict) return;
    const { request, user } = data;
    const verdict = request.verdict;
    if (!verdict) return;
    const config = await ctx.runQuery(internal.config.all, {});
    const set = (status: "building" | "validating" | "reviewing" | "preview", stage?: string, run?: Record<string, unknown>) =>
      ctx.runMutation(internal.requests.setStatus, { id: requestId, status, stage, run });
    const fail = (category: string, hint: string, error: string, cost = 0) =>
      ctx.runMutation(internal.pipeline.state.fail, { id: requestId, category, hint, error, costCents: cost });

    const modelKey = env("OPENROUTER_API_KEY");
    const coderModel = process.env.CODER_MODEL || config.coderModel;
    const repoSlug = env("GITHUB_REPO");
    const scope = verdict.scope;
    const startedAt = Date.now();
    await set("building", "starting sandbox", { startedAt });

    const kit = await octokit();
    const baseSha = await headSha(kit);
    const job = {
      requestId,
      systemPrompt: coderSystemPrompt(),
      userPrompt: coderUserPrompt({ prompt: request.prompt, plan: verdict.plan, target: request.target }),
      model: coderModel,
      maxSteps: config.maxTurns,
      maxTokens: 600_000,
      scope,
    };

    const snapshotId = process.env.SANDBOX_SNAPSHOT_ID;
    const creds = { token: env("VERCEL_TOKEN"), teamId: env("VERCEL_TEAM_ID"), projectId: env("VERCEL_PROJECT_ID") };
    const networkPolicy = {
      allow: {
        "openrouter.ai": [{ transform: [{ headers: { authorization: `Bearer ${modelKey}` } }] }],
        "github.com": [],
        "codeload.github.com": [],
        ...(snapshotId ? {} : { "registry.npmjs.org": [], "*.npmjs.org": [] }),
      },
    };
    const sandbox = await Sandbox.create({
      ...creds,
      ...(snapshotId
        ? { source: { type: "snapshot" as const, snapshotId } }
        : { source: { type: "git" as const, url: `https://github.com/${repoSlug}.git`, revision: baseSha }, runtime: "node22" as const }),
      timeout: config.sandboxTimeoutMs,
      resources: { vcpus: 2 },
      networkPolicy: networkPolicy as never,
    });

    let cost = 0;
    try {
      if (snapshotId) {
        await sandbox.runCommand("git", ["fetch", "--depth", "50", "origin", baseSha]);
        const co = await sandbox.runCommand("git", ["checkout", "-f", baseSha]);
        if (co.exitCode !== 0) throw new Error("checkout failed: " + (await co.stderr()));
      } else {
        await set("building", "installing");
        const install = await sandbox.runCommand("corepack", ["pnpm", "install", "--frozen-lockfile", "--prefer-offline"]);
        if (install.exitCode !== 0) throw new Error("install failed: " + (await install.stderr()).slice(-2000));
      }
      await sandbox.writeFiles([{ path: ".ab-out/job.json", content: Buffer.from(JSON.stringify(job)) }]);
      await set("building", "agent working");
      const runner = await sandbox.runCommand({
        cmd: "node",
        args: ["sandbox/runner.mjs", ".ab-out/job.json"],
        env: { AB_OUT: ".ab-out", AB_MODEL_KEY: "sandbox-placeholder", AB_MODEL_BASE_URL: process.env.MODEL_BASE_URL ?? "" },
      });
      const stdout = await runner.stdout();
      const line = stdout.split("\n").reverse().find((l) => l.startsWith("AB_RESULT "));
      const result: RunnerResult | null = line ? (JSON.parse(line.slice("AB_RESULT ".length)) as RunnerResult) : null;
      const price = priceFor(coderModel);
      cost = result ? costCents({ inputTokens: result.inputTokens, outputTokens: result.outputTokens }, price) : 0;
      if (!result || !result.ok) {
        await fail("build_failed", "The agent couldn't make it work cleanly. Try a smaller ask.", result?.error ?? "runner produced no result: " + (await runner.stderr()).slice(-1500), cost);
        return;
      }

      // Deterministic validation on our side of the wall.
      await set("validating", "checking the diff", { turns: result.steps, filesTouched: result.files });
      const diff = (await sandbox.readFileToBuffer({ path: ".ab-out/diff.patch" }))?.toString("utf8") ?? "";
      const fullFiles: Record<string, string> = {};
      const contents: Record<string, string | null> = {};
      for (const f of result.files) {
        const buf = await sandbox.readFileToBuffer({ path: f });
        if (buf) {
          fullFiles[f] = buf.toString("utf8");
          contents[f] = fullFiles[f]!;
        } else contents[f] = null;
      }
      const validation = validateDiff(diff, scope, { fullFiles });
      if (!validation.ok) {
        await fail("unsafe_code", "That change didn't pass the checks.", validation.problems.join("; "), cost);
        return;
      }

      // Second opinion on the code itself.
      await set("reviewing", "second opinion on the diff");
      const cfg: ModelConfig = {
        apiKey: modelKey,
        baseURL: process.env.MODEL_BASE_URL || undefined,
        judgeModel: config.judgeModel,
        redTeamModel: config.redTeamModel,
        reviewModel: process.env.REVIEW_MODEL || config.reviewModel,
      };
      const { review, usage } = await reviewDiff(cfg, { prompt: request.prompt, plan: verdict.plan, diff });
      cost += costCents(usage, priceFor(cfg.reviewModel));
      if (!review.approve || !review.matches_request || review.safety_concerns.length) {
        await fail("unsafe_code", "The reviewer wasn't comfortable with that diff.", [...review.safety_concerns, ...review.hidden_behavior].join("; ") || "review rejected", cost);
        return;
      }

      // Commit + PR, from here, with the App token that never entered the sandbox.
      await set("building", "opening pull request");
      const branch = `playground/${requestId}`;
      const coauthor = user.handle ? { name: user.handle, email: `${data.request.userId}+${user.handle}@users.noreply.github.com` } : undefined;
      const headShaNew = await commitFiles(kit, { baseSha, branch, files: contents, message: review.summary || result.summary, coauthor });
      const pr = await openPullRequest(kit, {
        branch,
        title: review.summary || result.summary,
        body: [`**Request** by @${user.handle}: ${request.prompt}`, ``, `**Plan**`, ...verdict.plan.map((p) => `- ${p}`), ``, `Scope: ${scope} · steps: ${result.steps} · cost: $${(cost / 100).toFixed(2)}`, ``, `Opened automatically by anyone.build.`].join("\n"),
        labels: ["playground"],
      });
      await set("preview", undefined, {
        branch,
        baseSha,
        headSha: headShaNew,
        prNumber: pr.number,
        prUrl: pr.url,
        summary: review.summary || result.summary,
        filesTouched: validation.files.map((f) => f.path),
        linesAdded: validation.added,
        linesRemoved: validation.removed,
        blockIds: validation.blockIds,
        costCents: cost,
        turns: result.steps,
      });
      // CI + preview deploy webhooks take it from here (tryMerge), with a safety poll in case a webhook is missed.
      await ctx.scheduler.runAfter(90_000, internal.pipeline.github.tryMerge, { requestId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await fail("build_failed", "Something broke while building. Try again in a minute.", msg, cost);
    } finally {
      await sandbox.stop().catch(() => {});
    }
  },
});
