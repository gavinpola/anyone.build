"use node";
import Stripe from "stripe";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import { validateBidInput } from "./patrons";
import { auctionSlotDay, siteDay } from "./lib/days";
import { sendEmail, outbidEmail, wonEmail, releasedEmail } from "./emails";

function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key) : null;
}
const fake = () => process.env.ALLOW_FAKE_PAYMENTS === "1";

/**
 * Place a bid: a Stripe Checkout session that only *authorizes* the amount (manual capture).
 * Nobody is charged until the auction closes; only the winner is captured.
 */
export const placeBid = action({
  args: { name: v.string(), url: v.optional(v.string()), blurb: v.optional(v.string()), logoId: v.optional(v.id("_storage")), amountCents: v.number() },
  handler: async (ctx, a): Promise<{ url: string }> => {
    const me = await ctx.runQuery(internal.patrons.viewerForBid, {});
    if (!me) throw new Error("Sign in first.");
    const { name, url, blurb } = validateBidInput(a);
    const config = await ctx.runQuery(internal.config.all, {});
    const amount = Math.round(a.amountCents);
    if (!Number.isFinite(amount) || amount < config.minBidCents) throw new Error(`Minimum bid is $${(config.minBidCents / 100).toFixed(0)}.`);
    if (amount > 9_999_900) throw new Error("That's a lot. Email us.");
    if (amount % 100 !== 0) throw new Error("Whole dollars only.");
    const slotDay = auctionSlotDay();
    const site = process.env.SITE_URL ?? "http://localhost:5173";

    const s = stripe();
    if (!s) {
      if (!fake()) throw new Error("Bidding isn't open yet.");
      const sessionId = `fake_cs_${Date.now()}`;
      await ctx.runMutation(internal.patrons.insertPending, { userId: me.id, slotDay, name, url, blurb, logoId: a.logoId, amountCents: amount, checkoutSessionId: sessionId });
      await ctx.runAction(internal.payments.onHoldPlaced, { checkoutSessionId: sessionId, paymentIntentId: `fake_pi_${Date.now()}`, email: undefined });
      return { url: `${site}/leaderboard?bid=held` };
    }
    const session = await s.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: amount, product_data: { name: "Patron of the day — anyone.build", description: `Bid for the ${slotDay} slot. Only the winner is charged, at midnight ET.` } } }],
      custom_text: { submit: { message: "This places a hold, not a charge. Only the top bid at midnight ET is charged; every other hold is released." } },
      payment_intent_data: { capture_method: "manual", description: `anyone.build patron bid · ${slotDay} · ${name}`, metadata: { slotDay, handle: me.handle } },
      success_url: `${site}/leaderboard?bid=held&cs={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/leaderboard?bid=cancelled`,
      metadata: { slotDay, handle: me.handle, name },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });
    await ctx.runMutation(internal.patrons.insertPending, { userId: me.id, slotDay, name, url, blurb, logoId: a.logoId, amountCents: amount, checkoutSessionId: session.id });
    return { url: session.url! };
  },
});

/** Stripe told us the hold is in place. Release the bidder's older holds; email the outbid leader. */
export const onHoldPlaced = internalAction({
  args: { checkoutSessionId: v.string(), paymentIntentId: v.string(), email: v.optional(v.string()) },
  handler: async (ctx, { checkoutSessionId, paymentIntentId, email }) => {
    const r = await ctx.runMutation(internal.patrons.markHeld, { checkoutSessionId, paymentIntentId, email });
    if (!r || r.already) return;
    const s = stripe();
    if (r.late) {
      if (s && !paymentIntentId.startsWith("fake_")) await s.paymentIntents.cancel(paymentIntentId).catch(() => {});
      if (r.email) await sendEmail(r.email, releasedEmail({ name: r.name ?? "", cents: r.amount ?? 0, slotDay: siteDay(), winningCents: 0 }));
      return;
    }
    for (const old of r.replaced) if (old.paymentIntentId && s) await s.paymentIntents.cancel(old.paymentIntentId).catch(() => {});
    if (r.outbid?.email) {
      await sendEmail(r.outbid.email, outbidEmail({ name: r.outbid.name, theirCents: r.outbid.amountCents, newCents: r.newAmount ?? 0, slotDay: r.slotDay ?? "" }));
    }
  },
});

export const releaseHold = internalAction({
  args: { paymentIntentId: v.string() },
  handler: async (_ctx, { paymentIntentId }) => {
    const s = stripe();
    if (s && !paymentIntentId.startsWith("fake_")) await s.paymentIntents.cancel(paymentIntentId).catch(() => {});
  },
});

/** Hourly. When the Eastern-Time date has just rolled over, close the new day's slot and tally yesterday. */
export const tickAuction = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const today = siteDay(now);
    const anHourAgo = siteDay(now - 3600_000);
    if (today === anHourAgo) return;
    await ctx.runAction(internal.payments.closeAuction, { slotDay: today });
    await ctx.runMutation(internal.patrons.tallyFunded, { day: anHourAgo });
  },
});

/** Capture the highest hold for the slot, release the rest, email everyone. Idempotent per slot. */
export const closeAuction = internalAction({
  args: { slotDay: v.optional(v.string()) },
  handler: async (ctx, { slotDay }) => {
    const day = slotDay ?? siteDay();
    if (await ctx.runQuery(internal.patrons.isClosed, { slotDay: day })) return;
    const bids = await ctx.runQuery(internal.patrons.bidsForClose, { slotDay: day });
    const s = stripe();
    let winner: (typeof bids)[number] | null = null;
    const total = bids.reduce((a, b) => a + b.amountCents, 0);
    for (const b of bids) {
      if (winner) {
        if (b.paymentIntentId && s && !b.paymentIntentId.startsWith("fake_")) await s.paymentIntents.cancel(b.paymentIntentId).catch(() => {});
        await ctx.runMutation(internal.patrons.setStatus, { id: b.id, status: "lost" });
        if (b.email) await sendEmail(b.email, releasedEmail({ name: b.name, cents: b.amountCents, slotDay: day, winningCents: winner.amountCents }));
        continue;
      }
      try {
        if (b.paymentIntentId && s && !b.paymentIntentId.startsWith("fake_")) await s.paymentIntents.capture(b.paymentIntentId);
        await ctx.runMutation(internal.patrons.setStatus, { id: b.id, status: "won" });
        winner = b;
        if (b.email) await sendEmail(b.email, wonEmail({ name: b.name, cents: b.amountCents, slotDay: day }));
      } catch (e) {
        console.error("capture failed", b.id, e);
        await ctx.runMutation(internal.patrons.setStatus, { id: b.id, status: "failed" });
      }
    }
    await ctx.runMutation(internal.patrons.recordClose, { slotDay: day, winnerBidId: winner?.id, winningCents: winner?.amountCents ?? 0, totalCents: total, bidCount: bids.length });
  },
});
