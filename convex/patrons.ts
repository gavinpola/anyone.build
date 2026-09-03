import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getViewerUser, requireUser } from "./users";
import { getAllConfig } from "./config";
import { auctionSlotDay, nextSiteMidnight, siteDay, siteDayStart } from "./lib/days";

const NAME_RE = /^[\p{L}\p{N} .,'&!?()\-–—:/+]{2,60}$/u;

export function validateBidInput(i: { name: string; url?: string; blurb?: string }) {
  const name = i.name.trim();
  if (!NAME_RE.test(name)) throw new Error("Name: 2-60 plain characters.");
  let url: string | undefined;
  if (i.url && i.url.trim()) {
    const raw = i.url.trim().replace(/^(?!https?:\/\/)/, "https://");
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      throw new Error("That website URL doesn't look right.");
    }
    if (u.protocol !== "https:") throw new Error("Website must be https.");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname)) throw new Error("Website must be a real domain.");
    u.hash = "";
    url = u.toString();
  }
  const blurb = (i.blurb ?? "").replace(/\s+/g, " ").trim().slice(0, 140) || undefined;
  return { name, url, blurb };
}

async function heldBids(ctx: QueryCtx, slotDay: string) {
  const rows = await ctx.db
    .query("bids")
    .withIndex("by_slot", (q) => q.eq("slotDay", slotDay).eq("status", "held"))
    .order("desc")
    .collect();
  rows.sort((a, b) => b.amountCents - a.amountCents || (a.heldAt ?? a.createdAt) - (b.heldAt ?? b.createdAt));
  return rows;
}

export async function publicBid(ctx: QueryCtx, b: Doc<"bids">, rank: number) {
  return {
    id: b._id,
    rank,
    name: b.name,
    url: b.url ?? null,
    blurb: b.blurb ?? null,
    logoUrl: b.logoId ? await ctx.storage.getUrl(b.logoId) : null,
    amountCents: b.amountCents,
    clicks: b.clicks,
    at: b.heldAt ?? b.createdAt,
    slotDay: b.slotDay,
    status: b.status,
  };
}

/** Today's patron (winner of today's slot) + the live auction for tomorrow's slot. */
export const board = query({
  args: {},
  handler: async (ctx) => {
    const c = await getAllConfig(ctx);
    const viewer = await getViewerUser(ctx);
    const today = siteDay();
    const slotDay = auctionSlotDay();
    const todayMeta = await ctx.db.query("patronDays").withIndex("by_day", (q) => q.eq("day", today)).unique();
    const winner = todayMeta?.winnerBidId ? await ctx.db.get(todayMeta.winnerBidId) : null;
    const held = await heldBids(ctx, slotDay);
    const bids = await Promise.all(held.map((b, i) => publicBid(ctx, b, i + 1)));
    const high = bids[0] ?? null;
    const mine = viewer ? held.find((b) => b.userId === viewer._id) : undefined;
    // Everyone who bid for today's slot stays on the page all day, even without winning.
    const lost = await ctx.db
      .query("bids")
      .withIndex("by_slot", (q) => q.eq("slotDay", today).eq("status", "lost"))
      .order("desc")
      .take(5);
    const runnersUp = await Promise.all(lost.map((b, i) => publicBid(ctx, b, i + 2)));
    return {
      today,
      patron: winner && winner.status === "won" ? await publicBid(ctx, winner, 1) : null,
      runnersUp,
      slotDay,
      closesAt: nextSiteMidnight(),
      bids,
      high,
      toBeatCents: high ? high.amountCents + c.bidStepCents : c.minBidCents,
      minBidCents: c.minBidCents,
      myBid: mine ? await publicBid(ctx, mine, held.indexOf(mine) + 1) : null,
      changesFundedToday: todayMeta?.changesFunded ?? 0,
    };
  },
});

/** Header slot: today's patron, and who is leading tomorrow's auction. */
export const today = query({
  args: {},
  handler: async (ctx) => {
    const meta = await ctx.db.query("patronDays").withIndex("by_day", (q) => q.eq("day", siteDay())).unique();
    const w = meta?.winnerBidId ? await ctx.db.get(meta.winnerBidId) : null;
    const held = await heldBids(ctx, auctionSlotDay());
    const lead = held[0];
    return {
      patron: w && w.status === "won" ? await publicBid(ctx, w, 1) : null,
      leader: lead ? { name: lead.name, amountCents: lead.amountCents } : null,
    };
  },
});

export const history = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const days = await ctx.db.query("patronDays").withIndex("by_day").order("desc").take(Math.min(limit ?? 30, 365));
    const out = [];
    for (const d of days) {
      if (!d.closed) continue;
      const w = d.winnerBidId ? await ctx.db.get(d.winnerBidId) : null;
      out.push({ day: d.day, bidCount: d.bidCount, totalCents: d.totalCents, winningCents: d.winningCents ?? 0, changesFunded: d.changesFunded, winner: w ? await publicBid(ctx, w, 1) : null });
    }
    return out;
  },
});

export const generateLogoUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Called by the checkout action after Stripe created the session. */
export const insertPending = internalMutation({
  args: {
    userId: v.id("users"),
    slotDay: v.string(),
    name: v.string(),
    url: v.optional(v.string()),
    blurb: v.optional(v.string()),
    logoId: v.optional(v.id("_storage")),
    email: v.optional(v.string()),
    amountCents: v.number(),
    checkoutSessionId: v.string(),
  },
  handler: async (ctx, a) => {
    return await ctx.db.insert("bids", { ...a, status: "pending", clicks: 0, createdAt: Date.now() });
  },
});

export const viewerForBid = internalQuery({
  args: {},
  handler: async (ctx) => {
    const u = await getViewerUser(ctx);
    return u ? { id: u._id, handle: u.handle, trust: u.trust } : null;
  },
});

/**
 * Hold placed (Stripe checkout completed). Returns the previous high bidder to notify, and any
 * older holds by the same bidder for the same slot, which the caller should release.
 */
export const markHeld = internalMutation({
  args: { checkoutSessionId: v.string(), paymentIntentId: v.string(), email: v.optional(v.string()) },
  handler: async (ctx, { checkoutSessionId, paymentIntentId, email }) => {
    const bid = await ctx.db.query("bids").withIndex("by_session", (q) => q.eq("checkoutSessionId", checkoutSessionId)).unique();
    if (!bid) return null;
    if (bid.status !== "pending") return { bidId: bid._id, already: true, outbid: null, replaced: [] as Array<{ id: Id<"bids">; paymentIntentId?: string }> };
    const before = await heldBids(ctx, bid.slotDay);
    const prevHigh = before[0] ?? null;
    await ctx.db.patch(bid._id, { status: "held", paymentIntentId, email: email ?? bid.email, heldAt: Date.now() });
    const replaced: Array<{ id: Id<"bids">; paymentIntentId?: string }> = [];
    for (const b of before) {
      if (b.userId === bid.userId) {
        await ctx.db.patch(b._id, { status: "cancelled", resolvedAt: Date.now() });
        replaced.push({ id: b._id, paymentIntentId: b.paymentIntentId });
      }
    }
    const outbid = prevHigh && prevHigh.userId !== bid.userId && prevHigh.amountCents < bid.amountCents ? { id: prevHigh._id, email: prevHigh.email ?? null, name: prevHigh.name, amountCents: prevHigh.amountCents } : null;
    return { bidId: bid._id, already: false, outbid, replaced, newAmount: bid.amountCents, slotDay: bid.slotDay, name: bid.name, email: bid.email ?? email ?? null };
  },
});

export const setStatus = internalMutation({
  args: { id: v.id("bids"), status: v.union(v.literal("won"), v.literal("lost"), v.literal("cancelled"), v.literal("failed"), v.literal("removed")) },
  handler: async (ctx, { id, status }) => {
    await ctx.db.patch(id, { status, resolvedAt: Date.now() });
  },
});

export const bidsForClose = internalQuery({
  args: { slotDay: v.string() },
  handler: async (ctx, { slotDay }) => {
    const rows = await heldBids(ctx, slotDay);
    return rows.map((b) => ({ id: b._id, amountCents: b.amountCents, paymentIntentId: b.paymentIntentId ?? null, email: b.email ?? null, name: b.name, userId: b.userId }));
  },
});

export const recordClose = internalMutation({
  args: { slotDay: v.string(), winnerBidId: v.optional(v.id("bids")), winningCents: v.number(), totalCents: v.number(), bidCount: v.number() },
  handler: async (ctx, { slotDay, winnerBidId, winningCents, totalCents, bidCount }) => {
    const meta = await ctx.db.query("patronDays").withIndex("by_day", (q) => q.eq("day", slotDay)).unique();
    const patch = { closed: true, winnerBidId, winningCents, totalCents, bidCount, changesFunded: 0 };
    if (meta) await ctx.db.patch(meta._id, patch);
    else await ctx.db.insert("patronDays", { day: slotDay, ...patch });
    if (winningCents > 0) {
      await ctx.runMutation(internal.stats.bump, { revenueCents: winningCents });
      const c = await getAllConfig(ctx);
      await ctx.runMutation(internal.budget.topUp, { day: slotDay, cents: Math.floor((winningCents * c.patronTopUpPct) / 100) });
    }
  },
});

/** At the end of each slot day, count the changes it funded. */
export const tallyFunded = internalMutation({
  args: { day: v.string() },
  handler: async (ctx, { day }) => {
    const meta = await ctx.db.query("patronDays").withIndex("by_day", (q) => q.eq("day", day)).unique();
    if (!meta) return;
    const start = siteDayStart(day);
    const changes = await ctx.db.query("changes").withIndex("by_mergedAt", (q) => q.gte("mergedAt", start).lt("mergedAt", start + 86400000)).collect();
    await ctx.db.patch(meta._id, { changesFunded: changes.filter((c) => !c.revertedAt).length });
  },
});

/** Click-through counting for /go/:bidId. */
export const recordClick = internalMutation({
  args: { bidId: v.id("bids") },
  handler: async (ctx, { bidId }) => {
    const b = await ctx.db.get(bidId);
    if (!b || !["won", "held"].includes(b.status) || !b.url) return null;
    await ctx.db.patch(bidId, { clicks: b.clicks + 1 });
    const day = siteDay();
    const s = await ctx.db.query("dayStats").withIndex("by_day", (q) => q.eq("day", day)).unique();
    if (s) await ctx.db.patch(s._id, { clicks: s.clicks + 1 });
    else await ctx.db.insert("dayStats", { day, views: 0, uniques: 0, clicks: 1 });
    return b.url;
  },
});

export const remove = mutation({
  args: { id: v.id("bids"), reason: v.string() },
  handler: async (ctx, { id }) => {
    const u = await requireUser(ctx);
    if (u.trust < 3) throw new Error("Maintainers only");
    const b = await ctx.db.get(id);
    if (!b) return;
    await ctx.db.patch(id, { status: "removed", resolvedAt: Date.now() });
    if (b.status === "held" && b.paymentIntentId) await ctx.scheduler.runAfter(0, internal.payments.releaseHold, { paymentIntentId: b.paymentIntentId });
  },
});

export const cancelByIntent = internalMutation({
  args: { paymentIntentId: v.string() },
  handler: async (ctx, { paymentIntentId }) => {
    const b = await ctx.db.query("bids").withIndex("by_intent", (q) => q.eq("paymentIntentId", paymentIntentId)).unique();
    if (b && b.status === "held") await ctx.db.patch(b._id, { status: "cancelled", resolvedAt: Date.now() });
  },
});

export const isClosed = internalQuery({
  args: { slotDay: v.string() },
  handler: async (ctx, { slotDay }) => {
    const meta = await ctx.db.query("patronDays").withIndex("by_day", (q) => q.eq("day", slotDay)).unique();
    return Boolean(meta?.closed);
  },
});
