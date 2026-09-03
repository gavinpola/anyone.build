import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getViewerUser } from "./users";
import { rateLimiter } from "./rateLimits";

const MAX_DOC_BYTES = 4 * 1024;
const MAX_NAMESPACE_DOCS = 5000;
const MAX_NAMESPACE_BYTES = 1024 * 1024;
const NAMESPACE_RE = /^[a-z0-9:_-]{1,64}$/;

/** Read a namespace (newest first, capped). Public. */
export const list = query({
  args: { namespace: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { namespace, limit }) => {
    if (!NAMESPACE_RE.test(namespace)) return [];
    const docs = await ctx.db
      .query("storeDocs")
      .withIndex("by_namespace", (q) => q.eq("namespace", namespace))
      .order("desc")
      .take(Math.min(limit ?? 200, 1000));
    return docs.map((d) => ({ key: d.key, value: d.value, by: d.by ?? null, at: d.at }));
  },
});

/** Upsert one doc. Signed-in only (anonymous gets a tiny allowance for counters). */
export const put = mutation({
  args: { namespace: v.string(), key: v.string(), value: v.any(), anonId: v.optional(v.string()) },
  handler: async (ctx, { namespace, key, value, anonId }) => {
    if (!NAMESPACE_RE.test(namespace)) throw new Error("Bad namespace");
    if (key.length > 128) throw new Error("Key too long");
    const bytes = JSON.stringify(value ?? null).length;
    if (bytes > MAX_DOC_BYTES) throw new Error("Value too large (4 KB max)");

    const viewer = await getViewerUser(ctx);
    const isCounter = namespace.startsWith("counter:");
    if (!viewer && !isCounter) throw new Error("Sign in to write");
    const limitKey = viewer ? `u:${viewer._id}` : `a:${anonId ?? "anon"}`;
    await rateLimiter.limit(ctx, viewer ? "storeWrite" : "storeWriteAnon", { key: limitKey, throws: true });

    const ns = await ctx.db
      .query("storeNamespaces")
      .withIndex("by_namespace", (q) => q.eq("namespace", namespace))
      .unique();
    const existing = await ctx.db
      .query("storeDocs")
      .withIndex("by_namespace_key", (q) => q.eq("namespace", namespace).eq("key", key))
      .unique();

    const countDelta = existing ? 0 : 1;
    const bytesDelta = bytes - (existing?.bytes ?? 0);
    const nextCount = (ns?.count ?? 0) + countDelta;
    const nextBytes = (ns?.bytes ?? 0) + bytesDelta;
    if (nextCount > MAX_NAMESPACE_DOCS || nextBytes > MAX_NAMESPACE_BYTES) {
      throw new Error("This namespace is full");
    }

    const row = {
      namespace,
      key,
      value,
      by: viewer?.handle,
      byUserId: viewer?._id,
      at: Date.now(),
      bytes,
    };
    if (existing) await ctx.db.replace(existing._id, row);
    else await ctx.db.insert("storeDocs", row);

    if (ns) await ctx.db.patch(ns._id, { count: nextCount, bytes: nextBytes });
    else await ctx.db.insert("storeNamespaces", { namespace, count: nextCount, bytes: nextBytes });
  },
});

/** Atomic counter bump. Anonymous allowed (rate-limited). */
export const bump = mutation({
  args: { name: v.string(), by: v.optional(v.number()), anonId: v.optional(v.string()) },
  handler: async (ctx, { name, by, anonId }) => {
    const namespace = `counter:${name}`;
    if (!NAMESPACE_RE.test(namespace)) throw new Error("Bad counter name");
    const delta = Math.max(-1, Math.min(1, Math.trunc(by ?? 1)));
    const viewer = await getViewerUser(ctx);
    const limitKey = viewer ? `u:${viewer._id}` : `a:${anonId ?? "anon"}`;
    await rateLimiter.limit(ctx, viewer ? "storeWrite" : "storeWriteAnon", { key: limitKey, throws: true });
    const existing = await ctx.db
      .query("storeDocs")
      .withIndex("by_namespace_key", (q) => q.eq("namespace", namespace).eq("key", "value"))
      .unique();
    const current = typeof existing?.value === "number" ? existing.value : 0;
    const next = current + delta;
    if (existing) await ctx.db.patch(existing._id, { value: next, at: Date.now() });
    else {
      await ctx.db.insert("storeDocs", { namespace, key: "value", value: next, at: Date.now(), bytes: 8 });
      await ctx.db.insert("storeNamespaces", { namespace, count: 1, bytes: 8 });
    }
    return next;
  },
});

export const remove = mutation({
  args: { namespace: v.string(), key: v.string() },
  handler: async (ctx, { namespace, key }) => {
    const viewer = await getViewerUser(ctx);
    if (!viewer) throw new Error("Sign in first");
    const existing = await ctx.db
      .query("storeDocs")
      .withIndex("by_namespace_key", (q) => q.eq("namespace", namespace).eq("key", key))
      .unique();
    if (!existing) return;
    if (existing.byUserId !== viewer._id && viewer.trust < 3) throw new Error("Not yours");
    await ctx.db.delete(existing._id);
    const ns = await ctx.db
      .query("storeNamespaces")
      .withIndex("by_namespace", (q) => q.eq("namespace", namespace))
      .unique();
    if (ns) await ctx.db.patch(ns._id, { count: Math.max(0, ns.count - 1), bytes: Math.max(0, ns.bytes - existing.bytes) });
  },
});
