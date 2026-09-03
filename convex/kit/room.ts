/**
 * The backend kit: the only way agent-written code under convex/rooms/<room>/ can define functions.
 *
 * Convex has no per-function permissions, so a raw ctx.db could read every table. Room code never
 * sees the raw ctx: it gets a facade over the shared document store, namespaced to its own room,
 * with hard caps. No actions, no scheduler, no fetch, no env. The validator and ESLint rules in
 * packages/gatekeeper enforce that room files only ever call roomQuery / roomMutation from here.
 *
 * Protected by CODEOWNERS; edited only by humans, via PR.
 */
import type { ObjectType, PropertyValidators } from "convex/values";
import type { RegisteredMutation, RegisteredQuery } from "convex/server";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { getViewerUser } from "../users";
import { rateLimiter } from "../rateLimits";

const ROOM_RE = /^[a-z0-9-]{1,32}$/;
const COL_RE = /^[a-z0-9-]{1,32}$/;
const KEY_RE = /^[A-Za-z0-9:_.-]{1,128}$/;
const MAX_DOC_BYTES = 4 * 1024;
const MAX_NAMESPACE_DOCS = 5000;
const MAX_NAMESPACE_BYTES = 1024 * 1024;
const LIST_MAX = 200;
const WRITES_PER_CALL = 100;
const LISTS_PER_CALL = 20;

export type RoomDoc<T = unknown> = { key: string; value: T; by: string | null; at: number };
export type RoomViewer = { id: string | null; handle: string; signedIn: boolean; trust: number };

export type RoomQueryCtx = {
  db: {
    get<T = unknown>(collection: string, key: string): Promise<RoomDoc<T> | null>;
    list<T = unknown>(collection: string, opts?: { limit?: number }): Promise<RoomDoc<T>[]>;
    count(collection: string): Promise<number>;
  };
  viewer: RoomViewer;
  now: number;
};

export type RoomMutationCtx = RoomQueryCtx & {
  db: RoomQueryCtx["db"] & {
    put(collection: string, key: string, value: unknown): Promise<void>;
    remove(collection: string, key: string): Promise<void>;
  };
  random(): number;
};

function assertRoom(room: string) {
  if (!ROOM_RE.test(room)) throw new Error(`Bad room id: ${room}`);
}

function ns(room: string, collection: string): string {
  if (!COL_RE.test(collection)) throw new Error(`Bad collection name: ${collection}`);
  return `room:${room}:${collection}`;
}

async function viewerOf(ctx: QueryCtx | MutationCtx): Promise<RoomViewer> {
  const u = await getViewerUser(ctx);
  return u ? { id: u._id, handle: u.handle, signedIn: true, trust: u.trust } : { id: null, handle: "guest", signedIn: false, trust: -1 };
}

function reads(ctx: QueryCtx | MutationCtx, room: string, budget: { lists: number }): RoomQueryCtx["db"] {
  return {
    async get(collection, key) {
      const d = await ctx.db
        .query("storeDocs")
        .withIndex("by_namespace_key", (q) => q.eq("namespace", ns(room, collection)).eq("key", key))
        .unique();
      return d ? { key: d.key, value: d.value, by: d.by ?? null, at: d.at } : null;
    },
    async list(collection, opts) {
      if (++budget.lists > LISTS_PER_CALL) throw new Error(`Too many reads in one call (max ${LISTS_PER_CALL})`);
      const limit = Math.max(1, Math.min(LIST_MAX, Math.trunc(opts?.limit ?? LIST_MAX)));
      const docs = await ctx.db
        .query("storeDocs")
        .withIndex("by_namespace", (q) => q.eq("namespace", ns(room, collection)))
        .order("desc")
        .take(limit);
      return docs.map((d) => ({ key: d.key, value: d.value, by: d.by ?? null, at: d.at }));
    },
    async count(collection) {
      const row = await ctx.db
        .query("storeNamespaces")
        .withIndex("by_namespace", (q) => q.eq("namespace", ns(room, collection)))
        .unique();
      return row?.count ?? 0;
    },
  };
}

function writes(ctx: MutationCtx, room: string, viewer: RoomViewer, budget: { writes: number }) {
  return {
    async put(collection: string, key: string, value: unknown) {
      if (++budget.writes > WRITES_PER_CALL) throw new Error(`Too many writes in one call (max ${WRITES_PER_CALL})`);
      if (!KEY_RE.test(key)) throw new Error("Bad key");
      const namespace = ns(room, collection);
      const bytes = JSON.stringify(value ?? null).length;
      if (bytes > MAX_DOC_BYTES) throw new Error("Value too large (4 KB max)");
      const existing = await ctx.db
        .query("storeDocs")
        .withIndex("by_namespace_key", (q) => q.eq("namespace", namespace).eq("key", key))
        .unique();
      const nsRow = await ctx.db
        .query("storeNamespaces")
        .withIndex("by_namespace", (q) => q.eq("namespace", namespace))
        .unique();
      const nextCount = (nsRow?.count ?? 0) + (existing ? 0 : 1);
      const nextBytes = (nsRow?.bytes ?? 0) + bytes - (existing?.bytes ?? 0);
      if (nextCount > MAX_NAMESPACE_DOCS || nextBytes > MAX_NAMESPACE_BYTES) throw new Error("This collection is full");
      const row = { namespace, key, value, by: viewer.signedIn ? viewer.handle : undefined, byUserId: (viewer.id ?? undefined) as never, at: Date.now(), bytes };
      if (existing) await ctx.db.replace(existing._id, row);
      else await ctx.db.insert("storeDocs", row);
      if (nsRow) await ctx.db.patch(nsRow._id, { count: nextCount, bytes: nextBytes });
      else await ctx.db.insert("storeNamespaces", { namespace, count: nextCount, bytes: nextBytes });
    },
    async remove(collection: string, key: string) {
      if (++budget.writes > WRITES_PER_CALL) throw new Error(`Too many writes in one call (max ${WRITES_PER_CALL})`);
      const namespace = ns(room, collection);
      const existing = await ctx.db
        .query("storeDocs")
        .withIndex("by_namespace_key", (q) => q.eq("namespace", namespace).eq("key", key))
        .unique();
      if (!existing) return;
      await ctx.db.delete(existing._id);
      const nsRow = await ctx.db
        .query("storeNamespaces")
        .withIndex("by_namespace", (q) => q.eq("namespace", namespace))
        .unique();
      if (nsRow) await ctx.db.patch(nsRow._id, { count: Math.max(0, nsRow.count - 1), bytes: Math.max(0, nsRow.bytes - existing.bytes) });
    },
  };
}

/** A public, read-only room function. Anyone can call it; it can only read its own room's collections. */
export function roomQuery<Args extends PropertyValidators>(
  room: string,
  def: { args: Args; handler: (ctx: RoomQueryCtx, args: ObjectType<Args>) => Promise<unknown> },
) {
  assertRoom(room);
  // Registered with the concrete validator type (a generic one leaves Convex's rest-tuple handler
  // signature unresolved), then cast back so api.rooms.<room>.<file>.<fn> has the right arg types.
  const built = query({
    args: def.args as PropertyValidators,
    handler: async (ctx: QueryCtx, args: Record<string, unknown>) => {
      const viewer = await viewerOf(ctx);
      return def.handler({ db: reads(ctx, room, { lists: 0 }), viewer, now: Date.now() }, args as ObjectType<Args>);
    },
  });
  return built as unknown as RegisteredQuery<"public", ObjectType<Args>, Promise<unknown>>;
}

/** A room function that writes. Signed-in only unless allowGuests; rate-limited like the kit store. */
export function roomMutation<Args extends PropertyValidators>(
  room: string,
  def: { args: Args; allowGuests?: boolean; handler: (ctx: RoomMutationCtx, args: ObjectType<Args>) => Promise<unknown> },
) {
  assertRoom(room);
  const built = mutation({
    args: def.args as PropertyValidators,
    handler: async (ctx: MutationCtx, args: Record<string, unknown>) => {
      const viewer = await viewerOf(ctx);
      if (!viewer.signedIn && !def.allowGuests) throw new Error("Sign in to do that.");
      await rateLimiter.limit(ctx, viewer.signedIn ? "storeWrite" : "storeWriteAnon", { key: viewer.id ? `u:${viewer.id}` : `room:${room}:anon`, throws: true });
      const budget = { lists: 0, writes: 0 };
      const db = { ...reads(ctx, room, budget), ...writes(ctx, room, viewer, budget) };
      return def.handler({ db, viewer, now: Date.now(), random: () => Math.random() }, args as ObjectType<Args>);
    },
  });
  return built as unknown as RegisteredMutation<"public", ObjectType<Args>, Promise<unknown>>;
}
