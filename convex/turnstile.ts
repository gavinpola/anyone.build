import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { parseGuestId } from "./lib/guest";

/**
 * Cloudflare Turnstile for guests. The browser gets a token from the widget, we verify it here
 * and hand back a short-lived single-use ticket that `requests.submit` consumes. When
 * TURNSTILE_SECRET is unset (local dev, CI) the check is skipped by `submit`.
 */
export const verify = action({
  args: { token: v.string(), guestId: v.string() },
  handler: async (ctx, { token, guestId }): Promise<{ ticket: string | null }> => {
    const secret = process.env.TURNSTILE_SECRET;
    const gid = parseGuestId(guestId);
    if (!secret || !gid) return { ticket: null };
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret, response: token }),
    });
    const json = (await res.json()) as { success?: boolean };
    if (!json.success) return { ticket: null };
    const ticket = crypto.randomUUID();
    await ctx.runMutation(internal.turnstile.issueTicket, { ticket, guestId: gid, expiresAt: Date.now() + 10 * 60 * 1000 });
    return { ticket };
  },
});

export const issueTicket = internalMutation({
  args: { ticket: v.string(), guestId: v.string(), expiresAt: v.number() },
  handler: async (ctx, a) => {
    await ctx.db.insert("guestTickets", { ...a, used: false });
  },
});

export const sweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    const old = await ctx.db.query("guestTickets").withIndex("by_expiresAt", (q) => q.lt("expiresAt", Date.now())).take(500);
    for (const t of old) await ctx.db.delete(t._id);
  },
});
