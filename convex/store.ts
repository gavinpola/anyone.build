import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getViewerUser } from "./users";
import { rateLimiter } from "./rateLimits";

const MAX_DOC_BYTES = 4 * 1024;
const MAX_NAMESPACE_DOCS = 5000;
const MAX_NAMESPACE_BYTES = 1024 * 1024;
const NAMESPACE_RE = /^[a-z0-9:_-]{1,64}$/;

// This public store shares the storeDocs table with the room-function kit (convex/kit/room.ts,
// which owns "room:*") and the counter system ("counter:*", integrity-guarded by bump()). The public
// API must never address those, or the kit's per-room isolation and one-vote-per-person guarantees
// leak. Blocks use plain, unprefixed namespaces; these prefixes are reserved for server code.
const RESERVED_PREFIXES = ["room:", "counter:"];
function assertPublicNamespace(namespace: string): void {
  if (!NAMESPACE_RE.test(namespace)) throw new Error("Bad namespace");
  if (RESERVED_PREFIXES.some((p) => namespace.startsWith(p))) throw new Error("Reserved namespace");
}

/** Read a namespace (newest first, capped). Public. */
export const list = query({
  args: { namespace: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { namespace, limit }) => {
    if (!NAMESPACE_RE.test(namespace) || RESERVED_PREFIXES.some((p) => namespace.startsWith(p))) return [];
    const docs = await ctx.db
      .query("storeDocs")
      .withIndex("by_namespace", (q) => q.eq("namespace", namespace))
      .order("desc")
      .take(Math.min(limit ?? 200, 1000));
    return docs.map((d) => ({ key: d.key, value: d.value, by: d.by ?? null, at: d.at }));
  },
});

/** Upsert one doc. Anyone may write (the wall is anyone's): signed-in people own docs by account, signed-out people by tab id, both rate-limited. */
export const put = mutation({
  args: { namespace: v.string(), key: v.string(), value: v.any(), anonId: v.optional(v.string()) },
  handler: async (ctx, { namespace, key, value, anonId }) => {
    assertPublicNamespace(namespace); // counters go through bump(); room:* is the kit's alone
    if (key.length > 128) throw new Error("Key too long");
    const bytes = JSON.stringify(value ?? null).length;
    if (bytes > MAX_DOC_BYTES) throw new Error("Value too large (4 KB max)");

    const viewer = await getViewerUser(ctx);
    const anon = viewer ? undefined : (anonId ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 40) || undefined;
    if (!viewer && !anon) throw new Error("Couldn't identify this browser. Reload and try again.");
    const limitKey = viewer ? `u:${viewer._id}` : `a:${anon}`;
    await rateLimiter.limit(ctx, viewer ? "storeWrite" : "storeWriteAnon", { key: limitKey, throws: true });

    const ns = await ctx.db
      .query("storeNamespaces")
      .withIndex("by_namespace", (q) => q.eq("namespace", namespace))
      .unique();
    const existing = await ctx.db
      .query("storeDocs")
      .withIndex("by_namespace_key", (q) => q.eq("namespace", namespace).eq("key", key))
      .unique();

    // Only the author (or a maintainer) may overwrite an existing doc; shared counters have no author.
    const mine = !existing || (viewer ? existing.byUserId === viewer._id : !existing.byUserId && existing.byAnonId === anon) || (viewer?.trust ?? 0) >= 3;
    if (!mine) throw new Error("Not yours");
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
      by: viewer?.handle ?? "guest",
      byUserId: viewer?._id,
      byAnonId: anon,
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
  args: { namespace: v.string(), key: v.string(), anonId: v.optional(v.string()) },
  handler: async (ctx, { namespace, key, anonId }) => {
    assertPublicNamespace(namespace); // was unchecked: room:*/counter:* were removable through here
    const viewer = await getViewerUser(ctx);
    const anon = viewer ? undefined : (anonId ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 40) || undefined;
    if (!viewer && !anon) throw new Error("Couldn't identify this browser. Reload and try again.");
    const existing = await ctx.db
      .query("storeDocs")
      .withIndex("by_namespace_key", (q) => q.eq("namespace", namespace).eq("key", key))
      .unique();
    if (!existing) return;
    const mine = (viewer ? existing.byUserId === viewer._id : !existing.byUserId && existing.byAnonId === anon) || (viewer?.trust ?? 0) >= 3;
    if (!mine) throw new Error("Not yours");
    await ctx.db.delete(existing._id);
    const ns = await ctx.db
      .query("storeNamespaces")
      .withIndex("by_namespace", (q) => q.eq("namespace", namespace))
      .unique();
    if (ns) await ctx.db.patch(ns._id, { count: Math.max(0, ns.count - 1), bytes: Math.max(0, ns.bytes - existing.bytes) });
  },
});
