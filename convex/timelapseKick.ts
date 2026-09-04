"use node";
import { internalAction } from "./_generated/server";
import { api } from "./_generated/api";
import { octokit } from "./pipeline/github";

/**
 * Keep the hourly frame coming. GitHub's own scheduler skips and delays runs on quiet repos, so once
 * an hour this asks GitHub to run the timelapse workflow when the latest frame is stale. It needs the
 * GitHub App to have the Actions (read and write) permission; until then GitHub answers 403 and this
 * quietly returns, and the workflow's own three-times-an-hour schedule carries on alone.
 */
const STALE_MS = 65 * 60 * 1000;

export const kick = internalAction({
  args: {},
  handler: async (ctx): Promise<{ dispatched: boolean; reason?: string }> => {
    const frames = await ctx.runQuery(api.timelapse.list, { limit: 1 });
    const latest = frames[frames.length - 1];
    if (latest && Date.now() - latest.at < STALE_MS) return { dispatched: false, reason: "fresh" };
    const repo = process.env.GITHUB_REPO ?? "";
    const [owner, name] = repo.split("/");
    if (!owner || !name) return { dispatched: false, reason: "no GITHUB_REPO" };
    try {
      const kit = await octokit();
      await kit.rest.actions.createWorkflowDispatch({ owner, repo: name, workflow_id: "timelapse.yml", ref: "main" });
      return { dispatched: true };
    } catch (e) {
      const msg = String((e as Error)?.message ?? e).slice(0, 160);
      console.log("timelapse kick skipped:", msg);
      return { dispatched: false, reason: msg };
    }
  },
});
