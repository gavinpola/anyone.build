"use node";
import { v } from "convex/values";
import { createHmac, timingSafeEqual } from "node:crypto";
import Stripe from "stripe";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

type Result = { ok: boolean; status: number; error?: string };

export const stripe = internalAction({
  args: { body: v.string(), signature: v.string() },
  handler: async (ctx, { body, signature }): Promise<Result> => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const key = process.env.STRIPE_SECRET_KEY;
    if (!secret || !key) return { ok: false, status: 503, error: "webhook not configured" };
    let event: Stripe.Event;
    try {
      event = new Stripe(key).webhooks.constructEvent(body, signature, secret);
    } catch {
      return { ok: false, status: 403, error: "bad signature" };
    }
    const fresh = await ctx.runMutation(internal.webhookLog.record, { source: "stripe", eventId: event.id, type: event.type });
    if (!fresh) return { ok: true, status: 200 };
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
      if (pi) await ctx.runAction(internal.payments.onHoldPlaced, { checkoutSessionId: session.id, paymentIntentId: pi, email: session.customer_details?.email ?? undefined });
    } else if (event.type === "checkout.session.expired") {
      // never completed; nothing to do, the pending row is ignored by every query
    } else if (event.type === "payment_intent.canceled") {
      const pi = event.data.object;
      await ctx.runMutation(internal.patrons.cancelByIntent, { paymentIntentId: pi.id });
    }
    return { ok: true, status: 200 };
  },
});

function verifyGithub(body: string, signature: string, secret: string) {
  const expected = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const github = internalAction({
  args: { body: v.string(), signature: v.string(), event: v.string(), delivery: v.string() },
  handler: async (ctx, { body, signature, event, delivery }): Promise<Result> => {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) return { ok: false, status: 503, error: "webhook not configured" };
    if (!verifyGithub(body, signature, secret)) return { ok: false, status: 403, error: "bad signature" };
    const fresh = await ctx.runMutation(internal.webhookLog.record, { source: "github", eventId: delivery, type: event });
    if (!fresh) return { ok: true, status: 200 };
    const payload = JSON.parse(body) as Record<string, unknown>;
    await ctx.runAction(internal.pipeline.github.onWebhook, { event, payload });
    return { ok: true, status: 200 };
  },
});

export const vercel = internalAction({
  args: { body: v.string(), signature: v.string() },
  handler: async (ctx, { body, signature }): Promise<Result> => {
    const secret = process.env.VERCEL_WEBHOOK_SECRET;
    if (!secret) return { ok: false, status: 503, error: "webhook not configured" };
    const expected = createHmac("sha1", secret).update(body).digest("hex");
    if (expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return { ok: false, status: 403, error: "bad signature" };
    const payload = JSON.parse(body) as { id: string; type: string; payload: Record<string, unknown> };
    const fresh = await ctx.runMutation(internal.webhookLog.record, { source: "vercel", eventId: payload.id, type: payload.type });
    if (!fresh) return { ok: true, status: 200 };
    await ctx.runAction(internal.pipeline.github.onVercel, { type: payload.type, payload: payload.payload });
    return { ok: true, status: 200 };
  },
});
