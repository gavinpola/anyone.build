import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * Credit everything a browser did as a guest to the user who just signed in there.
 * Pure enough to unit test: no auth here, the caller checks that.
 */
export async function claimGuestRows(ctx: MutationCtx, user: Doc<"users">, guest: Doc<"guests">) {
  if (guest.userId && guest.userId !== user._id) throw new Error("Those changes were already claimed by another account.");
  if (!guest.userId) await ctx.db.patch(guest._id, { userId: user._id, claimedAt: Date.now() });
  let requests = 0;
  let changes = 0;
  let lines = 0;
  let reverted = 0;
  const reqs = await ctx.db.query("requests").withIndex("by_guest", (q) => q.eq("guestId", guest.guestId)).take(500);
  for (const r of reqs) {
    if (r.userId) continue;
    await ctx.db.patch(r._id, { userId: user._id });
    requests++;
  }
  const chs = await ctx.db.query("changes").withIndex("by_guest", (q) => q.eq("guestId", guest.guestId)).take(500);
  for (const c of chs) {
    if (c.userId) continue;
    await ctx.db.patch(c._id, { userId: user._id });
    changes++;
    if (c.revertedAt) reverted++;
    else lines += c.linesAdded + c.linesRemoved;
  }
  if (changes > 0) {
    await ctx.runMutation(internal.users.adjustStats, { userId: user._id, liveChanges: changes - reverted, linesChanged: lines, reverted, strikes: reverted });
  }
  return { requests, changes };
}
