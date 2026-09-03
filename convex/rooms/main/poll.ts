import { v } from "convex/values";
import { roomMutation, roomQuery } from "../../kit/room";

/** One vote per signed-in person per poll. The reference room function; blocks call it as "poll:results" / "poll:vote". */
export const results = roomQuery("main", {
  args: { poll: v.string() },
  handler: async (ctx, { poll }) => {
    const docs = await ctx.db.list<{ choice?: string }>(`poll-${poll}`, { limit: 200 });
    const tally: Record<string, number> = {};
    for (const d of docs) {
      const c = String(d.value?.choice ?? "");
      if (c) tally[c] = (tally[c] ?? 0) + 1;
    }
    const mine = ctx.viewer.id ? (docs.find((d) => d.key === ctx.viewer.id)?.value?.choice ?? null) : null;
    return { tally, total: docs.length, mine };
  },
});

export const vote = roomMutation("main", {
  args: { poll: v.string(), choice: v.string() },
  handler: async (ctx, { poll, choice }) => {
    if (!/^[a-z0-9-]{1,24}$/.test(poll) || choice.length < 1 || choice.length > 40) throw new Error("Bad vote");
    await ctx.db.put(`poll-${poll}`, ctx.viewer.id!, { choice });
  },
});
