import { v } from "convex/values";
import { httpAction, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * The wall, every hour. A scheduled job (.github/workflows/timelapse.yml) screenshots the live wall and
 * POSTs the frame here with a shared token; frames live in Convex file storage for 30 days and play as a
 * timelapse on the leaderboard page, which the wall itself can't change.
 */
const KEEP_DAYS = 30;

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db.query("timelapse").withIndex("by_at").order("desc").take(Math.max(1, Math.min(limit ?? 96, 24 * KEEP_DAYS)));
    const out = [];
    for (const r of rows) {
      const url = await ctx.storage.getUrl(r.storageId);
      if (url) out.push({ id: r._id, at: r.at, url, width: r.width, height: r.height, changes: r.changes, here: r.here });
    }
    return out.reverse(); // oldest first
  },
});

export const record = internalMutation({
  args: { storageId: v.id("_storage"), width: v.number(), height: v.number(), bytes: v.number(), changes: v.number(), here: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.insert("timelapse", { at: Date.now(), ...args });
  },
});

export const prune = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
    const old = await ctx.db.query("timelapse").withIndex("by_at", (q) => q.lt("at", cutoff)).take(200);
    for (const r of old) {
      await ctx.storage.delete(r.storageId).catch(() => {});
      await ctx.db.delete(r._id);
    }
    return old.length;
  },
});

/** POST /timelapse/upload?changes=N&here=N&width=W&height=H with the image body and `Authorization: Bearer <TIMELAPSE_TOKEN>`. */
export const upload = httpAction(async (ctx, request) => {
  const token = process.env.TIMELAPSE_TOKEN;
  const auth = request.headers.get("authorization") ?? "";
  if (!token || auth !== `Bearer ${token}`) return new Response("nope", { status: 401 });
  const url = new URL(request.url);
  const num = (k: string, d: number) => {
    const n = Number(url.searchParams.get(k));
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : d;
  };
  const type = request.headers.get("content-type") ?? "";
  if (!/^image\/(jpeg|png|webp)$/.test(type)) return new Response("image only", { status: 415 });
  const blob = await request.blob();
  if (blob.size === 0 || blob.size > 3 * 1024 * 1024) return new Response("bad size", { status: 413 });
  const storageId = await ctx.storage.store(blob);
  await ctx.runMutation(internal.timelapse.record, { storageId, width: num("width", 1280), height: num("height", 1600), bytes: blob.size, changes: num("changes", 0), here: num("here", 0) });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
});
