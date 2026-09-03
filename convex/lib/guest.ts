import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getViewerUser } from "../users";

export const GUEST_ID_RE = /^[a-f0-9]{32}$/;

export function parseGuestId(s?: string | null): string | null {
  return s && GUEST_ID_RE.test(s) ? s : null;
}

/** Public, unguessable, never derived from the secret. */
export function makeGuestTag(): string {
  const a = "abcdefghijklmnopqrstuvwxyz0123456789";
  let t = "";
  for (let i = 0; i < 4; i++) t += a[Math.floor(Math.random() * a.length)];
  return t;
}

export type Actor = { user: Doc<"users"> | null; guest: Doc<"guests"> | null };

export async function findGuest(ctx: QueryCtx, guestId: string | null): Promise<Doc<"guests"> | null> {
  if (!guestId) return null;
  return await ctx.db
    .query("guests")
    .withIndex("by_guestId", (q) => q.eq("guestId", guestId))
    .unique();
}

/** Who is acting: a signed-in user, a known guest, or (lazily created) a new guest. */
export async function resolveActor(ctx: MutationCtx, rawGuestId?: string | null, opts: { create?: boolean } = {}): Promise<Actor> {
  const user = await getViewerUser(ctx);
  const guestId = parseGuestId(rawGuestId);
  let guest = await findGuest(ctx, guestId);
  if (!guest && guestId && opts.create) {
    const id = await ctx.db.insert("guests", { guestId, tag: makeGuestTag(), requests: 0, createdAt: Date.now(), lastSeenAt: Date.now() });
    guest = await ctx.db.get(id);
  }
  return { user, guest };
}

export function guestHandle(g: Doc<"guests">): string {
  return `guest-${g.tag}`;
}
