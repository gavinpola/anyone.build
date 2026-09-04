import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getViewerUser } from "./users";
import { rateLimiter } from "./rateLimits";

/**
 * High scores for games on the wall. Any block can have a leaderboard: useHighScores("<game>") from
 * the kit reads the top and submits a score. One row per person per game (their best); the top 50 kept;
 * guests may post too (rate-limited per tab), with a name of their choosing or "guest".
 */
const GAME_RE = /^[a-z0-9-]{1,40}$/;
const KEEP = 50;

export const top = query({
  args: { game: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { game, limit }) => {
    if (!GAME_RE.test(game)) return [];
    const rows = await ctx.db.query("scores").withIndex("by_game_score", (q) => q.eq("game", game)).order("desc").take(Math.max(1, Math.min(limit ?? 10, KEEP)));
    return rows.map((r, i) => ({ id: r._id, rank: i + 1, handle: r.handle, score: r.score, at: r.at }));
  },
});

export const submit = mutation({
  args: { game: v.string(), score: v.number(), anonId: v.optional(v.string()), name: v.optional(v.string()) },
  handler: async (ctx, { game, score, anonId, name }) => {
    if (!GAME_RE.test(game)) throw new Error("Bad game id");
    if (!Number.isFinite(score) || score < 0 || score > 1e9) throw new Error("Bad score");
    const s = Math.floor(score);
    const viewer = await getViewerUser(ctx);
    const owner = viewer ? `u:${viewer._id}` : `a:${(anonId ?? "anon").replace(/[^a-z0-9]/gi, "").slice(0, 40) || "anon"}`;
    await rateLimiter.limit(ctx, viewer ? "scoreSubmit" : "scoreSubmitAnon", { key: owner, throws: true });
    const cleaned = (name ?? "").replace(/[^\w .'-]/g, "").trim().slice(0, 16);
    const handle = viewer ? viewer.handle : cleaned || "guest";
    const existing = await ctx.db.query("scores").withIndex("by_game_owner", (q) => q.eq("game", game).eq("owner", owner)).unique();
    if (existing && existing.score >= s) {
      const above = await ctx.db.query("scores").withIndex("by_game_score", (q) => q.eq("game", game).gt("score", existing.score)).take(KEEP);
      return { kept: false, best: existing.score, rank: above.length + 1 };
    }
    if (existing) await ctx.db.patch(existing._id, { score: s, handle, at: Date.now() });
    else await ctx.db.insert("scores", { game, score: s, handle, owner, userId: viewer?._id, at: Date.now() });
    // keep the table small: only the top KEEP per game survive
    const all = await ctx.db.query("scores").withIndex("by_game_score", (q) => q.eq("game", game)).order("desc").take(KEEP + 25);
    for (const r of all.slice(KEEP)) await ctx.db.delete(r._id);
    const above = await ctx.db.query("scores").withIndex("by_game_score", (q) => q.eq("game", game).gt("score", s)).take(KEEP);
    return { kept: true, best: s, rank: above.length + 1 };
  },
});
