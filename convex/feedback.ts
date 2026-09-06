import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { getViewerUser, requireUser } from "./users";
import { whoAsked } from "./proposals";
import { rateLimiter } from "./rateLimits";

/**
 * Feedback on the site itself (the chrome: header, map, composer, pipeline), which the wall's own
 * pipeline never touches. Anyone signed in can leave a note and vote; the board sorts by votes. A
 * maintainer approves one and it becomes a job: a GitHub issue in the repo that asks the coding
 * agent (@claude) to open a pull request, which a maintainer then merges. Approval is the only human
 * step, and it is one click.
 */
const MAX = 600;

export const statusValidator = v.union(v.literal("open"), v.literal("approved"), v.literal("done"), v.literal("declined"));

function requireMaintainer(user: { trust: number }) {
  if (user.trust < 3) throw new Error("Only a maintainer can do that.");
}

export const submit = mutation({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    const user = await requireUser(ctx);
    const t = text.replace(/\s+/g, " ").trim().slice(0, MAX);
    if (t.length < 8) throw new Error("Say a little more.");
    await rateLimiter.limit(ctx, "flag", { key: `feedback:${user._id}`, throws: true });
    const id = await ctx.db.insert("feedback", { text: t, userId: user._id, status: "open", votes: 0, createdAt: Date.now() });
    return id;
  },
});

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const viewer = await getViewerUser(ctx);
    const rows = await ctx.db.query("feedback").order("desc").take(Math.min(limit ?? 100, 200));
    const out = [];
    for (const f of rows) {
      const mine = viewer ? await ctx.db.query("feedbackVotes").withIndex("by_feedback_user", (q) => q.eq("feedbackId", f._id).eq("userId", viewer._id)).unique() : null;
      const u = await ctx.db.get(f.userId);
      out.push({
        id: f._id,
        text: f.text,
        by: whoAsked(u),
        mine: viewer ? f.userId === viewer._id : false,
        status: f.status,
        votes: f.votes,
        myVote: Boolean(mine),
        issueUrl: f.issueUrl ?? null,
        prUrl: f.prUrl ?? null,
        createdAt: f.createdAt,
        approvedAt: f.approvedAt ?? null,
      });
    }
    // open first, most voted, then newest; then what's in flight, then done and declined
    const rank = { open: 0, approved: 1, done: 2, declined: 3 } as const;
    out.sort((a, b) => rank[a.status] - rank[b.status] || b.votes - a.votes || b.createdAt - a.createdAt);
    return out;
  },
});

export const vote = mutation({
  args: { feedbackId: v.id("feedback") },
  handler: async (ctx, { feedbackId }) => {
    const user = await requireUser(ctx);
    await rateLimiter.limit(ctx, "storeWrite", { key: `fvote:${user._id}`, throws: true });
    const f = await ctx.db.get(feedbackId);
    if (!f || f.status !== "open") return { voted: false, votes: f?.votes ?? 0 };
    const existing = await ctx.db
      .query("feedbackVotes")
      .withIndex("by_feedback_user", (q) => q.eq("feedbackId", feedbackId).eq("userId", user._id))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      const votes = Math.max(0, f.votes - 1);
      await ctx.db.patch(feedbackId, { votes });
      return { voted: false, votes };
    }
    await ctx.db.insert("feedbackVotes", { feedbackId, userId: user._id, createdAt: Date.now() });
    const votes = f.votes + 1;
    await ctx.db.patch(feedbackId, { votes });
    return { voted: true, votes };
  },
});

/** A maintainer says yes: the note becomes a job (a GitHub issue that asks the agent for a PR). */
export const approve = mutation({
  args: { feedbackId: v.id("feedback") },
  handler: async (ctx, { feedbackId }) => {
    const user = await requireUser(ctx);
    requireMaintainer(user);
    const f = await ctx.db.get(feedbackId);
    if (!f || f.status !== "open") throw new Error("That one is not open.");
    await ctx.db.patch(feedbackId, { status: "approved", approvedBy: user._id, approvedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.pipeline.github.openFeedbackIssue, { feedbackId });
    return null;
  },
});

export const decline = mutation({
  args: { feedbackId: v.id("feedback") },
  handler: async (ctx, { feedbackId }) => {
    const user = await requireUser(ctx);
    requireMaintainer(user);
    const f = await ctx.db.get(feedbackId);
    if (!f) return null;
    await ctx.db.patch(feedbackId, { status: "declined" });
    return null;
  },
});

/** The PR landed (a maintainer marks it; the issue closes on merge). */
export const markDone = mutation({
  args: { feedbackId: v.id("feedback"), prUrl: v.optional(v.string()) },
  handler: async (ctx, { feedbackId, prUrl }) => {
    const user = await requireUser(ctx);
    requireMaintainer(user);
    const f = await ctx.db.get(feedbackId);
    if (!f) return null;
    await ctx.db.patch(feedbackId, { status: "done", prUrl: prUrl?.slice(0, 300) ?? f.prUrl });
    return null;
  },
});

/** What the issue needs: the note, who left it, and its votes. */
export const forIssue = internalMutation({
  args: { feedbackId: v.id("feedback") },
  handler: async (ctx, { feedbackId }) => {
    const f = await ctx.db.get(feedbackId);
    if (!f) return null;
    const u = await ctx.db.get(f.userId);
    return { text: f.text, votes: f.votes, by: u?.handle ?? "someone", createdAt: f.createdAt, issueUrl: f.issueUrl ?? null };
  },
});

export const issued = internalMutation({
  args: { feedbackId: v.id("feedback"), issueUrl: v.string(), issueNumber: v.number() },
  handler: async (ctx, { feedbackId, issueUrl, issueNumber }) => {
    await ctx.db.patch(feedbackId, { issueUrl, issueNumber });
    return null;
  },
});

/** The issue could not be opened: back to open, so a maintainer can try again once the cause is fixed. */
export const issueFailed = internalMutation({
  args: { feedbackId: v.id("feedback"), error: v.string() },
  handler: async (ctx, { feedbackId, error }) => {
    await ctx.db.patch(feedbackId, { status: "open", approvedAt: undefined, approvedBy: undefined, issueError: error.slice(0, 300) });
    return null;
  },
});
