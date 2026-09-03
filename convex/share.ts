import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * What a shared link may show: only what the public feed and leaderboard already show. Rejected,
 * failed, and cancelled asks are private to the person who asked, so they read as "not public".
 * Keyed by request id, which every surface (composer, feed card, ledger row, vote row) has.
 */
const PUBLIC = new Set(["queued", "building", "validating", "reviewing", "preview", "merging", "live", "proposed"]);

export const request = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const rid = ctx.db.normalizeId("requests", id);
    if (!rid) return null;
    const r = await ctx.db.get(rid);
    if (!r || !PUBLIC.has(r.status)) return null;
    const u = r.userId ? await ctx.db.get(r.userId) : null;
    const change = r.status === "live" ? await ctx.db.query("changes").withIndex("by_request", (q) => q.eq("requestId", rid)).first() : null;
    return {
      id: r._id,
      status: r.status,
      ask: r.prompt,
      by: { handle: u?.handle ?? "a guest", avatarUrl: u?.avatarUrl ?? null, guest: !u },
      roomId: r.roomId,
      primaryBlockId: change?.primaryBlockId ?? r.target.blockId ?? null,
      blockIds: change?.blockIds ?? [],
      summary: change?.summary ?? r.run?.summary ?? null,
      linesAdded: change?.linesAdded ?? null,
      reverted: Boolean(change?.revertedAt),
      votes: r.status === "proposed" ? (r.proposalVotes ?? 0) : null,
      createdAt: r.createdAt,
      mergedAt: change?.mergedAt ?? null,
    };
  },
});
