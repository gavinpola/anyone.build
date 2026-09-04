import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { rateLimiter } from "./rateLimits";

/** Rows in the retired needs_human status (nothing new lands there) expire after a day so they never swallow new asks. */
export const expireNeedsHuman = internalMutation({
  args: { olderThanMs: v.optional(v.number()) },
  handler: async (ctx, { olderThanMs }) => {
    const cutoff = Date.now() - (olderThanMs ?? 24 * 3600 * 1000);
    const rows = await ctx.db.query("requests").withIndex("by_status", (q) => q.eq("status", "needs_human").lt("createdAt", cutoff)).take(200);
    for (const r of rows) {
      await ctx.db.patch(r._id, {
        status: "rejected",
        verdict: r.verdict ? { ...r.verdict, approved: false, category: "unclear", hint: "This one sat in an old queue that no longer exists. Ask again and the judge will decide." } : undefined,
        updatedAt: Date.now(),
      });
    }
    return rows.length;
  },
});

/**
 * Reset everyone's per-person submit windows. A fixed-window bucket stores tokens REMAINING, so
 * loosening a limit doesn't unblock a window that was already exhausted under the old rate until it
 * rolls over. Run this once after raising the submit caps. Keys are handled server-side only.
 */
export const resetSubmitWindows = internalMutation({
  args: {},
  handler: async (ctx) => {
    let n = 0;
    const guests = await ctx.db.query("guests").take(5000);
    for (const g of guests) {
      await rateLimiter.reset(ctx, "submitGuest", { key: `g:${g.guestId}` });
      n++;
    }
    const users = await ctx.db.query("users").take(5000);
    for (const u of users) {
      for (const name of ["submitTrust0", "submitTrust1", "submitTrust2", "submitTrust3"] as const) {
        await rateLimiter.reset(ctx, name, { key: u._id });
      }
      n++;
    }
    return { reset: n };
  },
});

/**
 * Nothing stays stuck. Every ten minutes: a "preview" older than 20 minutes gets its merge re-tried (a
 * missed check webhook); "merging" older than 30 minutes is treated as deployed (Vercel takes two);
 * a build with no finished result after 20 minutes is failed and its budget and lock released (the
 * action died); "queued" older than two hours is let go with an honest hint.
 */
export const reconcile = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const older = (status: "preview" | "merging" | "building" | "validating" | "reviewing" | "queued", ms: number) =>
      ctx.db.query("requests").withIndex("by_status", (q) => q.eq("status", status).lt("createdAt", now - ms)).take(50);
    let touched = 0;
    for (const r of await older("preview", 20 * 60 * 1000)) {
      if (now - r.updatedAt < 15 * 60 * 1000) continue;
      await ctx.scheduler.runAfter(0, internal.pipeline.github.tryMerge, { requestId: r._id });
      touched++;
    }
    for (const r of await older("merging", 30 * 60 * 1000)) {
      if (now - r.updatedAt < 20 * 60 * 1000) continue;
      if (r.run?.mergeSha) await ctx.scheduler.runAfter(0, internal.pipeline.state.markLiveBySha, { sha: r.run.mergeSha });
      touched++;
    }
    for (const status of ["building", "validating", "reviewing"] as const) {
      for (const r of await older(status, 20 * 60 * 1000)) {
        if (now - r.updatedAt < 20 * 60 * 1000) continue;
        await ctx.scheduler.runAfter(0, internal.pipeline.state.fail, { id: r._id, category: "build_failed", hint: "The build stalled. Ask again; it's usually fine the second time.", error: `reconcile: stuck in ${status}` });
        touched++;
      }
    }
    for (const r of await older("queued", 2 * 60 * 60 * 1000)) {
      await ctx.scheduler.runAfter(0, internal.pipeline.state.fail, { id: r._id, category: "slow_down", hint: "The wall stayed busy for two hours and this one never got its turn. Ask again.", error: "reconcile: queued too long" });
      touched++;
    }
    return touched;
  },
});

