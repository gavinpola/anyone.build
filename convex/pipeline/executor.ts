import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, internalMutation } from "../_generated/server";
import { getAllConfig } from "../config";
import { fastEligible } from "./fastRules";

/**
 * Executor entry. `EXECUTOR=sandbox` runs the real Vercel Sandbox pipeline (pipeline/build.ts);
 * anything else walks the request through the real status sequence with fake timings so the
 * whole product can be exercised (and demoed) before any infra is configured.
 */
export const enqueue = internalMutation({
  args: { requestId: v.id("requests") },
  handler: async (ctx, _args) => {
    await ctx.scheduler.runAfter(0, internal.pipeline.executor.pump, {});
  },
});

/**
 * Scheduler: starts queued requests while respecting one-build-per-block and the global
 * concurrency cap. Runs after every enqueue and every completion; safe to call any time.
 */
export const pump = internalMutation({
  args: {},
  handler: async (ctx) => {
    const c = await getAllConfig(ctx);
    const locks = await ctx.db.query("buildLocks").collect();
    // Expire dead locks (a crashed build) after 12 minutes.
    const now = Date.now();
    // 25 min: longer than CI's longest job (playtest, 15) so a same-block build never starts under a live one
    for (const l of locks) if (now - l.lockedAt > 25 * 60 * 1000) await ctx.db.delete(l._id);
    const live = locks.filter((l) => now - l.lockedAt <= 25 * 60 * 1000);
    let running = live.filter((l) => l.key.startsWith("run:")).length;
    if (running >= c.maxConcurrentBuilds) return;
    const held = new Set(live.map((l) => l.key));
    const queued = await ctx.db.query("requests").withIndex("by_status", (q) => q.eq("status", "queued")).order("asc").take(50);
    for (const r of queued) {
      if (running >= c.maxConcurrentBuilds) break;
      if (held.has(`run:${r._id}`)) continue; // already started
      const key = r.target.blockId && r.target.blockId !== "__new__" ? `block:${r.roomId}:${r.target.blockId}` : `new:${r._id}`;
      if (held.has(key)) continue; // someone else is changing this block; wait
      held.add(key);
      await ctx.db.insert("buildLocks", { key, requestId: r._id, lockedAt: now });
      await ctx.db.insert("buildLocks", { key: `run:${r._id}`, requestId: r._id, lockedAt: now });
      running++;
      await ctx.scheduler.runAfter(0, internal.pipeline.executor.start, { requestId: r._id });
    }
  },
});

export const release = internalMutation({
  args: { requestId: v.id("requests") },
  handler: async (ctx, { requestId }) => {
    const locks = await ctx.db.query("buildLocks").collect();
    for (const l of locks) if (l.requestId === requestId) await ctx.db.delete(l._id);
    await ctx.scheduler.runAfter(0, internal.pipeline.executor.pump, {});
  },
});

export const start = internalAction({
  args: { requestId: v.id("requests") },
  handler: async (ctx, { requestId }) => {
    const data = await ctx.runQuery(internal.requests.getInternal, { id: requestId });
    if (!data || data.request.status !== "queued") {
      await ctx.runMutation(internal.pipeline.executor.release, { requestId });
      return;
    }
    if (process.env.EXECUTOR === "sandbox") {
      let outcome: string | undefined;
      try {
        // A tiny change to one existing file: one model call, no sandbox. Falls back to the sandbox when unusable.
        const config = await ctx.runQuery(internal.config.all, {});
        const fast = fastEligible(data.request, config);
        let handled = false;
        if (fast.ok) handled = (await ctx.runAction(internal.pipeline.fast.run, { requestId })).handled;
        if (!handled) await ctx.runAction(internal.pipeline.build.run, { requestId });
        outcome =(await ctx.runQuery(internal.requests.getInternal, { id: requestId }))?.request.status;
      } finally {
        // The block lock lives until the change is live or dead (state.markLiveBySha / state.fail / cancel release it).
        if (!outcome || !["preview", "merging"].includes(outcome)) await ctx.runMutation(internal.pipeline.executor.release, { requestId });
      }
      return;
    }
    await ctx.runMutation(internal.pipeline.executor.mockStep, { requestId, step: 0 });
  },
});

const MOCK_STEPS: Array<{ status: "building" | "validating" | "reviewing" | "preview" | "merging" | "live"; stage?: string; delayMs: number }> = [
  { status: "building", stage: "cloning the wall", delayMs: 1200 },
  { status: "building", stage: "agent · step 3", delayMs: 3500 },
  { status: "validating", stage: "typecheck · lint · build", delayMs: 2500 },
  { status: "reviewing", stage: "second opinion on the diff", delayMs: 2000 },
  { status: "preview", delayMs: 4000 },
  { status: "merging", stage: "rebasing on main", delayMs: 2500 },
  { status: "live", delayMs: 0 },
];

export const mockStep = internalMutation({
  args: { requestId: v.id("requests"), step: v.number() },
  handler: async (ctx, { requestId, step }) => {
    const r = await ctx.db.get(requestId);
    if (!r || ["cancelled", "rejected", "failed", "live"].includes(r.status)) {
      await ctx.runMutation(internal.pipeline.executor.release, { requestId });
      return;
    }
    const s = MOCK_STEPS[step];
    if (!s) return;
    const run = { ...(r.run ?? {}) };
    if (s.status === "preview") {
      run.previewUrl = "https://anyone-build-preview.vercel.app";
      run.prUrl = "https://github.com/anyone-build/everyones.lol/pull/0";
      run.linesAdded = 12;
      run.linesRemoved = 2;
      run.summary = "Did the thing you asked, and nothing else. (mock executor)";
      run.filesTouched = [r.target.path];
    }
    if (s.status === "building" && !run.startedAt) run.startedAt = Date.now();
    if (s.status === "live") {
      run.finishedAt = Date.now();
      run.costCents = 3;
      await ctx.db.insert("changes", {
        requestId,
        userId: r.userId,
        guestId: r.guestId,
        roomId: r.roomId,
        blockIds: r.target.blockId ? [r.target.blockId] : [],
        primaryBlockId: r.target.blockId,
        files: [r.target.path],
        linesAdded: run.linesAdded ?? 0,
        linesRemoved: run.linesRemoved ?? 0,
        sha: "mock",
        prNumber: 0,
        prUrl: run.prUrl ?? "",
        summary: run.summary ?? "",
        mergedAt: Date.now(),
        flagCount: 0,
      });
      if (r.userId) await ctx.runMutation(internal.users.adjustStats, { userId: r.userId, liveChanges: 1, linesChanged: (run.linesAdded ?? 0) + (run.linesRemoved ?? 0) });
      await ctx.runMutation(internal.stats.bump, { changes: 1 });
      await ctx.runMutation(internal.requests.settleOnce, { id: requestId, spentCents: run.costCents });
    }
    await ctx.db.patch(requestId, { status: s.status, stage: s.stage, run, updatedAt: Date.now(), ...(s.status === "live" ? { pinnedUntil: Date.now() + 60_000 } : {}) });
    if (step + 1 < MOCK_STEPS.length) {
      await ctx.scheduler.runAfter(s.delayMs, internal.pipeline.executor.mockStep, { requestId, step: step + 1 });
    } else {
      await ctx.runMutation(internal.pipeline.executor.release, { requestId });
    }
  },
});
