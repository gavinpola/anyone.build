import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, internalQuery } from "../_generated/server";

/** Pipeline state transitions that the Node actions (build/github) call into. */

export const findByBranch = internalQuery({
  args: { branch: v.string() },
  handler: async (ctx, { branch }) => {
    const id = branch.replace(/^playground\//, "");
    if (!/^[a-z0-9]+$/i.test(id)) return null;
    const r = await ctx.db.get(id as never);
    return r && "prompt" in r ? r : null;
  },
});

export const findByMergeSha = internalQuery({
  args: { sha: v.string() },
  handler: async (ctx, { sha }) => {
    const rows = await ctx.db.query("requests").withIndex("by_status", (q) => q.eq("status", "merging")).take(200);
    return rows.find((r) => r.run?.mergeSha === sha || r.run?.headSha === sha) ?? null;
  },
});

export const fail = internalMutation({
  args: { id: v.id("requests"), category: v.string(), hint: v.string(), error: v.optional(v.string()), costCents: v.optional(v.number()) },
  handler: async (ctx, { id, category, hint, error, costCents }) => {
    const r = await ctx.db.get(id);
    if (!r || ["live", "cancelled", "failed", "rejected"].includes(r.status)) return;
    await ctx.db.patch(id, {
      status: "failed",
      stage: undefined,
      verdict: r.verdict ? { ...r.verdict, approved: false, category: category as never, hint } : undefined,
      run: { ...(r.run ?? {}), error, finishedAt: Date.now(), costCents: costCents ?? r.run?.costCents },
      updatedAt: Date.now(),
    });
    await ctx.runMutation(internal.requests.settleOnce, { id, spentCents: costCents ?? r.run?.costCents ?? 0 });
    await ctx.runMutation(internal.pipeline.executor.release, { requestId: id });
  },
});

/** Fast path → sandbox: put an in-flight request back in the queue, keeping what the attempt cost. */
export const requeue = internalMutation({
  args: { id: v.id("requests"), costCents: v.optional(v.number()), fastFailed: v.optional(v.boolean()) },
  handler: async (ctx, { id, costCents, fastFailed }) => {
    const r = await ctx.db.get(id);
    if (!r || !["queued", "building", "validating", "reviewing", "preview"].includes(r.status)) return;
    // back to the queue with the fast path's PR details cleared (the sandbox opens its own), cost carried
    const { prNumber: _pr, prUrl: _url, headSha: _sha, previewUrl: _prev, ...rest } = r.run ?? {};
    await ctx.db.patch(id, { status: "queued", stage: fastFailed ? "trying again in the sandbox" : undefined, run: { ...rest, costCents: costCents ?? r.run?.costCents, ...(fastFailed ? { fastFailed: true } : {}) }, updatedAt: Date.now() });
  },
});

export const setPreview = internalMutation({
  args: { id: v.id("requests"), previewUrl: v.string() },
  handler: async (ctx, { id, previewUrl }) => {
    const r = await ctx.db.get(id);
    if (!r) return;
    await ctx.db.patch(id, { run: { ...(r.run ?? {}), previewUrl }, updatedAt: Date.now() });
  },
});

/** merging → preview, only if still merging (a transient merge error). */
export const unmerge = internalMutation({
  args: { id: v.id("requests") },
  handler: async (ctx, { id }) => {
    const r = await ctx.db.get(id);
    if (!r || r.status !== "merging") return;
    await ctx.db.patch(id, { status: "preview", stage: "merge retry", updatedAt: Date.now() });
  },
});

export const acquireMergeLock = internalMutation({
  args: { id: v.id("requests") },
  handler: async (ctx, { id }) => {
    const lock = await ctx.db.query("mergeLock").withIndex("by_key", (q) => q.eq("key", "main")).unique();
    const stale = lock?.lockedAt && Date.now() - lock.lockedAt > 5 * 60 * 1000;
    if (lock && lock.requestId && !stale) return false; // not re-entrant: one merge at a time, even for the same request
    if (lock) await ctx.db.patch(lock._id, { requestId: id, lockedAt: Date.now() });
    else await ctx.db.insert("mergeLock", { key: "main", requestId: id, lockedAt: Date.now() });
    return true;
  },
});

export const releaseMergeLock = internalMutation({
  args: { id: v.id("requests") },
  handler: async (ctx, { id }) => {
    const lock = await ctx.db.query("mergeLock").withIndex("by_key", (q) => q.eq("key", "main")).unique();
    if (lock && lock.requestId === id) await ctx.db.patch(lock._id, { requestId: undefined, lockedAt: undefined });
  },
});

export const markMerged = internalMutation({
  args: { id: v.id("requests"), mergeSha: v.string() },
  handler: async (ctx, { id, mergeSha }) => {
    const r = await ctx.db.get(id);
    if (!r) return;
    await ctx.db.patch(id, { status: "merging", stage: "deploying", run: { ...(r.run ?? {}), mergeSha }, updatedAt: Date.now() });
  },
});

/** Production deploy landed: everything merged into that sha (or before it) is live. */
export const markLiveBySha = internalMutation({
  args: { sha: v.string() },
  handler: async (ctx, { sha }) => {
    const merging = await ctx.db.query("requests").withIndex("by_status", (q) => q.eq("status", "merging")).take(200);
    const c = await ctx.runQuery(internal.config.all, {});
    for (const r of merging) {
      const run = r.run ?? {};
      // A production deploy includes every earlier merge; be generous and mark all merging requests
      // whose merge happened before this deploy started (they were merged, so they are in this build).
      if (run.mergeSha !== sha && r.updatedAt > Date.now() - 10_000) continue;
      await ctx.db.patch(r._id, { status: "live", stage: undefined, run: { ...run, finishedAt: Date.now() }, pinnedUntil: Date.now() + c.pinSeconds * 1000, updatedAt: Date.now() });
      await ctx.db.insert("changes", {
        requestId: r._id,
        userId: r.userId,
        guestId: r.guestId,
        roomId: r.roomId,
        blockIds: run.blockIds ?? (r.target.blockId && r.target.blockId !== "__new__" ? [r.target.blockId] : []),
        primaryBlockId: run.blockIds?.[0] ?? (r.target.blockId !== "__new__" ? r.target.blockId : undefined),
        files: run.filesTouched ?? [],
        linesAdded: run.linesAdded ?? 0,
        linesRemoved: run.linesRemoved ?? 0,
        sha: run.mergeSha ?? sha,
        prNumber: run.prNumber ?? 0,
        prUrl: run.prUrl ?? "",
        summary: run.summary ?? "",
        mergedAt: Date.now(),
        flagCount: 0,
        votes: 0,
      });
    // a landed change is the strongest touch: the block's decay clock resets
    await ctx.runMutation(internal.life.touchInternal, { roomId: r.roomId, blockIds: r.run?.blockIds?.length ? r.run.blockIds : r.target.blockId ? [r.target.blockId] : [] });
      if (r.userId) await ctx.runMutation(internal.users.adjustStats, { userId: r.userId, liveChanges: 1, linesChanged: (run.linesAdded ?? 0) + (run.linesRemoved ?? 0) });
      await ctx.runMutation(internal.stats.bump, { changes: 1 });
      await ctx.runMutation(internal.requests.settleOnce, { id: r._id, spentCents: run.costCents ?? 0 });
      await ctx.runMutation(internal.pipeline.executor.release, { requestId: r._id });
    }
  },
});

export const changeById = internalQuery({
  args: { id: v.id("changes") },
  handler: async (ctx, { id }) => {
    const c = await ctx.db.get(id);
    if (!c) return null;
    const u = c.userId ? await ctx.db.get(c.userId) : null;
    return { change: c, handle: u?.handle ?? "a guest" };
  },
});
