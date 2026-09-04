"use node";
import { App } from "@octokit/app";
import { Octokit as OctokitCore } from "@octokit/rest";
import { throttling } from "@octokit/plugin-throttling";
import { retry } from "@octokit/plugin-retry";

// A burst of merges hits GitHub's secondary rate limits; the throttling plugin waits and retries
// (twice) instead of failing the request, and the retry plugin covers transient 5xx.
const Octokit = OctokitCore.plugin(throttling, retry).defaults({
  throttle: {
    onRateLimit: (_retryAfter: number, _options: unknown, _kit: unknown, retryCount: number) => retryCount < 2,
    onSecondaryRateLimit: (_retryAfter: number, _options: unknown, _kit: unknown, retryCount: number) => retryCount < 2,
  },
  retry: { doNotRetry: [400, 401, 403, 404, 422] },
});
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

/** GitHub App operations: commit via the Git Data API, PRs, merges, reverts, and inbound events. */

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}
function repoParts() {
  const [owner, repo] = env("GITHUB_REPO").split("/");
  if (!owner || !repo) throw new Error("GITHUB_REPO must be owner/repo");
  return { owner, repo };
}

export async function octokit() {
  const app = new App({ appId: env("GITHUB_APP_ID"), privateKey: env("GITHUB_APP_PRIVATE_KEY").replace(/\\n/g, "\n"), Octokit });
  return (await app.getInstallationOctokit(Number(env("GITHUB_APP_INSTALLATION_ID")))) as unknown as Kit;
}
export type Kit = InstanceType<typeof Octokit>;

export async function headSha(kit: Kit, branch = "main"): Promise<string> {
  const { owner, repo } = repoParts();
  const { data } = await kit.rest.repos.getBranch({ owner, repo, branch });
  return data.commit.sha;
}

export async function fileAt(kit: Kit, path: string, ref: string): Promise<string | null> {
  const { owner, repo } = repoParts();
  try {
    const { data } = await kit.rest.repos.getContent({ owner, repo, path, ref });
    if (Array.isArray(data) || data.type !== "file") return null;
    return Buffer.from(data.content, "base64").toString("utf8");
  } catch {
    return null;
  }
}

/** Create one commit on `branch` from `baseSha` with the given file contents (null = delete). */
export async function commitFiles(
  kit: Kit,
  opts: { baseSha: string; branch: string; files: Record<string, string | null>; message: string; coauthor?: { name: string; email: string } },
): Promise<string> {
  const { owner, repo } = repoParts();
  const base = await kit.rest.git.getCommit({ owner, repo, commit_sha: opts.baseSha });
  const tree: Array<{ path: string; mode: "100644"; type: "blob"; sha: string | null }> = [];
  for (const [path, content] of Object.entries(opts.files)) {
    if (content === null) {
      tree.push({ path, mode: "100644", type: "blob", sha: null });
    } else {
      const blob = await kit.rest.git.createBlob({ owner, repo, content: Buffer.from(content, "utf8").toString("base64"), encoding: "base64" });
      tree.push({ path, mode: "100644", type: "blob", sha: blob.data.sha });
    }
  }
  const newTree = await kit.rest.git.createTree({ owner, repo, base_tree: base.data.tree.sha, tree });
  const message = opts.coauthor ? `${opts.message}\n\nCo-authored-by: ${opts.coauthor.name} <${opts.coauthor.email}>` : opts.message;
  const author = { name: process.env.GITHUB_BOT_NAME ?? "everyones.lol", email: process.env.GITHUB_BOT_EMAIL ?? "bot@everyones.lol", date: new Date().toISOString() };
  const commit = await kit.rest.git.createCommit({ owner, repo, message, tree: newTree.data.sha, parents: [opts.baseSha], author, committer: author });
  try {
    await kit.rest.git.createRef({ owner, repo, ref: `refs/heads/${opts.branch}`, sha: commit.data.sha });
  } catch {
    await kit.rest.git.updateRef({ owner, repo, ref: `heads/${opts.branch}`, sha: commit.data.sha, force: true });
  }
  return commit.data.sha;
}

export async function openPullRequest(kit: Kit, opts: { branch: string; title: string; body: string; labels?: string[] }) {
  const { owner, repo } = repoParts();
  const pr = await kit.rest.pulls.create({ owner, repo, title: opts.title.slice(0, 200), head: opts.branch, base: "main", body: opts.body });
  if (opts.labels?.length) await kit.rest.issues.addLabels({ owner, repo, issue_number: pr.data.number, labels: opts.labels }).catch(() => {});
  return { number: pr.data.number, url: pr.data.html_url };
}

export async function closePullRequest(kit: Kit, number: number, branch?: string) {
  const { owner, repo } = repoParts();
  await kit.rest.pulls.update({ owner, repo, pull_number: number, state: "closed" }).catch(() => {});
  if (branch) await kit.rest.git.deleteRef({ owner, repo, ref: `heads/${branch}` }).catch(() => {});
}

async function checksGreen(kit: Kit, sha: string): Promise<"green" | "pending" | "red"> {
  const { owner, repo } = repoParts();
  const runs = await kit.rest.checks.listForRef({ owner, repo, ref: sha, per_page: 100 });
  const statuses = await kit.rest.repos.getCombinedStatusForRef({ owner, repo, ref: sha });
  // "checks" (typecheck, lint, tests, build, validator) and "playtest" (every changed block mounted, played, and looked at).
  const required = (process.env.REQUIRED_CHECKS ?? "checks,playtest").split(",").map((s) => s.trim()).filter(Boolean);
  const byName = new Map<string, string>();
  for (const r of runs.data.check_runs) byName.set(r.name, r.status === "completed" ? (r.conclusion ?? "failure") : "pending");
  for (const s of statuses.data.statuses) byName.set(s.context, s.state === "success" ? "success" : s.state === "pending" ? "pending" : "failure");
  let pending = false;
  for (const name of required) {
    const st = byName.get(name);
    if (!st || st === "pending" || st === "queued" || st === "in_progress") pending = true;
    else if (st !== "success" && st !== "neutral" && st !== "skipped") return "red";
  }
  return pending ? "pending" : "green";
}

/** Try to merge a request's PR once all required checks pass. Serialized by the merge lock. */
export const tryMerge = internalAction({
  args: { requestId: v.id("requests") },
  handler: async (ctx, { requestId }) => {
    const data = await ctx.runQuery(internal.requests.getInternal, { id: requestId });
    const r = data?.request;
    if (!r || r.status !== "preview" || !r.run?.prNumber || !r.run.headSha) return;
    if (data?.request.settled) return;
    const kit = await octokit();
    const state = await checksGreen(kit, r.run.headSha);
    if (state === "pending") return;
    if (state === "red") {
      // The fast path has no compiler in its loop; when its PR goes red, the sandbox (which does) gets one go.
      if (r.run.turns === 1 && !r.run.fastFailed) {
        console.log("fast path PR went red; handing the request to the sandbox:", requestId);
        await closePullRequest(kit, r.run.prNumber, r.run.branch);
        await ctx.runMutation(internal.pipeline.state.requeue, { id: requestId, costCents: r.run.costCents, fastFailed: true });
        await ctx.runMutation(internal.pipeline.executor.release, { requestId });
        return;
      }
      await ctx.runMutation(internal.pipeline.state.fail, { id: requestId, category: "build_failed", hint: "The checks didn't pass. Try a smaller ask.", error: "CI failed" });
      await closePullRequest(kit, r.run.prNumber, r.run.branch);
      await ctx.runMutation(internal.pipeline.executor.release, { requestId });
      return;
    }
    const got = await ctx.runMutation(internal.pipeline.state.acquireMergeLock, { id: requestId });
    if (!got) {
      await ctx.scheduler.runAfter(5000, internal.pipeline.github.tryMerge, { requestId });
      return;
    }
    const { owner, repo } = repoParts();
    try {
      const pr = await kit.rest.pulls.get({ owner, repo, pull_number: r.run.prNumber });
      if (pr.data.mergeable === false) {
        await closePullRequest(kit, r.run.prNumber, r.run.branch);
        if (!r.run.collidedRetry) {
          // main moved under this PR: rebuild once from the new base instead of making the person re-ask
          await ctx.runMutation(internal.pipeline.state.requeue, { id: requestId, collidedRetry: true });
          await ctx.runMutation(internal.pipeline.executor.release, { requestId });
          return;
        }
        await ctx.runMutation(internal.pipeline.state.fail, { id: requestId, category: "collided", hint: "The wall moved under you twice. Try again on the new version.", error: "merge conflict (after one rebuild)" });
        await ctx.runMutation(internal.pipeline.executor.release, { requestId });
        return;
      }
      const won = await ctx.runMutation(internal.requests.beginMerge, { id: requestId });
      if (!won) return; // someone else is merging it (or it was cancelled meanwhile)
      const merged = await kit.rest.pulls.merge({
        owner,
        repo,
        pull_number: r.run.prNumber,
        merge_method: "squash",
        commit_title: `${r.run.summary ?? "Change on the wall"} (#${r.run.prNumber})`,
        commit_message: `Requested by ${data?.user ? "@" + data.user.handle : (data?.guest?.handle ?? "a guest")} on everyones.lol\n\n${r.prompt}`,
      });
      await ctx.runMutation(internal.pipeline.state.markMerged, { id: requestId, mergeSha: merged.data.sha });
      await kit.rest.git.deleteRef({ owner, repo, ref: `heads/${r.run.branch}` }).catch(() => {});
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/405|409|not mergeable|conflict/i.test(msg)) {
        await ctx.runMutation(internal.pipeline.state.fail, { id: requestId, category: "collided", hint: "The wall moved under you. Try again on the new version.", error: msg });
        await closePullRequest(kit, r.run.prNumber, r.run.branch);
        await ctx.runMutation(internal.pipeline.executor.release, { requestId });
      } else {
        // Transient: put it back to preview (setStatus refuses if it went terminal) and retry.
        await ctx.runMutation(internal.pipeline.state.unmerge, { id: requestId });
        await ctx.scheduler.runAfter(15_000, internal.pipeline.github.tryMerge, { requestId });
      }
    } finally {
      await ctx.runMutation(internal.pipeline.state.releaseMergeLock, { id: requestId });
    }
  },
});

/** Inbound GitHub events (signature already verified). */
export const onWebhook = internalAction({
  args: { event: v.string(), payload: v.any() },
  handler: async (ctx, { event, payload }) => {
    const p = payload as Record<string, unknown>;
    if (event === "check_suite" || event === "check_run" || event === "status") {
      const branch =
        event === "check_suite"
          ? ((p.check_suite as { head_branch?: string } | undefined)?.head_branch ?? "")
          : event === "check_run"
            ? ((p.check_run as { check_suite?: { head_branch?: string } } | undefined)?.check_suite?.head_branch ?? "")
            : ((p.branches as Array<{ name: string }> | undefined)?.[0]?.name ?? "");
      if (!branch.startsWith("playground/")) return;
      const r = await ctx.runQuery(internal.pipeline.state.findByBranch, { branch });
      if (r) await ctx.runAction(internal.pipeline.github.tryMerge, { requestId: r._id });
      return;
    }
    if (event === "deployment_status") {
      const ds = p.deployment_status as { state?: string; environment?: string; environment_url?: string; target_url?: string } | undefined;
      const dep = p.deployment as { ref?: string; sha?: string; environment?: string } | undefined;
      if (!ds || !dep || ds.state !== "success") return;
      const envName = (ds.environment ?? dep.environment ?? "").toLowerCase();
      if (envName.includes("production")) {
        if (dep.sha) await ctx.runMutation(internal.pipeline.state.markLiveBySha, { sha: dep.sha });
        return;
      }
      const url = ds.environment_url ?? ds.target_url;
      if (dep.ref?.startsWith("playground/") && url) {
        const r = await ctx.runQuery(internal.pipeline.state.findByBranch, { branch: dep.ref });
        if (r) {
          await ctx.runMutation(internal.pipeline.state.setPreview, { id: r._id, previewUrl: url });
          await ctx.runAction(internal.pipeline.github.tryMerge, { requestId: r._id });
        }
      }
      return;
    }
    if (event === "pull_request") {
      const action = p.action as string;
      const pr = p.pull_request as { merged?: boolean; head?: { ref?: string } } | undefined;
      const branch = pr?.head?.ref ?? "";
      if (action === "closed" && pr && !pr.merged && branch.startsWith("playground/")) {
        const r = await ctx.runQuery(internal.pipeline.state.findByBranch, { branch });
        if (r && !["live", "failed", "cancelled"].includes(r.status)) {
          await ctx.runMutation(internal.requests.setStatus, { id: r._id, status: "cancelled", stage: "closed on GitHub" });
          await ctx.runMutation(internal.pipeline.executor.release, { requestId: r._id });
        }
      }
    }
  },
});

/** Inbound Vercel events (signature already verified). Backup path for deploy status. */
export const onVercel = internalAction({
  args: { type: v.string(), payload: v.any() },
  handler: async (ctx, { type, payload }) => {
    if (type !== "deployment.succeeded" && type !== "deployment.ready") return;
    const p = payload as { deployment?: { meta?: Record<string, string>; url?: string }; target?: string | null; url?: string };
    const meta = p.deployment?.meta ?? {};
    const sha = meta.githubCommitSha;
    const ref = meta.githubCommitRef;
    const url = p.deployment?.url ? `https://${p.deployment.url}` : p.url ? `https://${p.url}` : undefined;
    if (p.target === "production" && sha) {
      await ctx.runMutation(internal.pipeline.state.markLiveBySha, { sha });
    } else if (ref?.startsWith("playground/") && url) {
      const r = await ctx.runQuery(internal.pipeline.state.findByBranch, { branch: ref });
      if (r) await ctx.runMutation(internal.pipeline.state.setPreview, { id: r._id, previewUrl: url });
    }
  },
});

/** Maintainer revert: restore every touched file to its pre-change version on a new branch + PR, then merge. */
export const revertChange = internalAction({
  args: { changeId: v.id("changes") },
  handler: async (ctx, { changeId }) => {
    const data = await ctx.runQuery(internal.pipeline.state.changeById, { id: changeId });
    if (!data) return;
    const { change } = data;
    const kit = await octokit();
    const { owner, repo } = repoParts();
    const commit = await kit.rest.repos.getCommit({ owner, repo, ref: change.sha });
    const parent = commit.data.parents[0]?.sha;
    if (!parent) return;
    const base = await headSha(kit);
    const files: Record<string, string | null> = {};
    for (const f of commit.data.files ?? []) {
      if (!f.filename.startsWith("src/rooms/")) continue;
      files[f.filename] = f.status === "added" ? null : await fileAt(kit, f.filename, parent);
    }
    if (!Object.keys(files).length) return;
    const branch = `revert/${String(changeId).slice(-8)}-${Date.now().toString(36)}`;
    const sha = await commitFiles(kit, { baseSha: base, branch, files, message: `Revert "${change.summary}" (#${change.prNumber})` });
    const pr = await openPullRequest(kit, { branch, title: `Revert: ${change.summary}`, body: `Maintainer revert of #${change.prNumber} (${change.sha}).`, labels: ["playground", "revert"] });
    // Reverts are maintainer-initiated; merge as soon as GitHub reports it mergeable.
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      const state = await checksGreen(kit, sha);
      if (state === "green") break;
      if (state === "red") return;
    }
    await kit.rest.pulls.merge({ owner, repo, pull_number: pr.number, merge_method: "squash" }).catch(() => {});
  },
});
