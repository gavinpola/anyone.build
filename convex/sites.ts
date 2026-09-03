import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { getViewerUser } from "./users";
import { rateLimiter } from "./rateLimits";
import { normalizeOrigin } from "./lib/notes";

const MAX_SITES = 10;

function newKey(): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return "site_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function publicSite(s: Doc<"sites">) {
  return {
    id: s._id,
    key: s.key,
    name: s.name,
    origin: s.origin,
    tier: s.tier,
    notes: s.notes,
    open: s.open,
    createdAt: s.createdAt,
    lastNoteAt: s.lastNoteAt ?? null,
  };
}

async function ownedSite(ctx: MutationCtx, siteId: Id<"sites">) {
  const user = await getViewerUser(ctx);
  if (!user) throw new Error("Sign in first.");
  const site = await ctx.db.get(siteId);
  if (!site || site.ownerId !== user._id) throw new Error("That site isn't yours.");
  return { user, site };
}

/** Add a site. One origin each; the same origin twice returns the existing site. */
export const create = mutation({
  args: { name: v.string(), origin: v.string() },
  handler: async (ctx, args) => {
    const user = await getViewerUser(ctx);
    if (!user) throw new Error("Sign in with GitHub to add a site.");
    if (user.banned) throw new Error("This account can't add sites.");
    const name = args.name.replace(/\s+/g, " ").trim().slice(0, 60);
    if (name.length < 1) throw new Error("Give the site a name.");
    const origin = normalizeOrigin(args.origin);
    if (!origin) throw new Error("Use the exact origin, like https://example.com (no path).");
    const mine = await ctx.db
      .query("sites")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    const existing = mine.find((s) => s.origin === origin);
    if (existing) return { id: existing._id, key: existing.key, existed: true };
    if (mine.length >= MAX_SITES) throw new Error(`Up to ${MAX_SITES} sites for now.`);
    await rateLimiter.limit(ctx, "siteCreate", { key: user._id, throws: true });
    const id = await ctx.db.insert("sites", {
      ownerId: user._id,
      key: newKey(),
      name,
      origin,
      tier: "notes",
      notes: 0,
      open: 0,
      createdAt: Date.now(),
    });
    const site = (await ctx.db.get(id))!;
    return { id, key: site.key, existed: false };
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await getViewerUser(ctx);
    if (!user) return [];
    const rows = await ctx.db
      .query("sites")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    return rows.sort((a, b) => a.createdAt - b.createdAt).map(publicSite);
  },
});

/** Removes the site and its notes. Owner only. */
export const remove = mutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const { site } = await ownedSite(ctx, siteId);
    for (let i = 0; i < 10; i++) {
      const batch = await ctx.db
        .query("notes")
        .withIndex("by_site", (q) => q.eq("siteId", site._id))
        .take(200);
      for (const n of batch) await ctx.db.delete(n._id);
      if (batch.length < 200) break;
    }
    await ctx.db.delete(site._id);
  },
});

export const notes = query({
  args: {
    siteId: v.id("sites"),
    status: v.optional(v.union(v.literal("new"), v.literal("done"), v.literal("dismissed"))),
  },
  handler: async (ctx, { siteId, status }) => {
    const user = await getViewerUser(ctx);
    if (!user) return [];
    const site = await ctx.db.get(siteId);
    if (!site || site.ownerId !== user._id) return [];
    const rows = status
      ? await ctx.db
          .query("notes")
          .withIndex("by_site_status", (q) => q.eq("siteId", siteId).eq("status", status))
          .order("desc")
          .take(100)
      : await ctx.db
          .query("notes")
          .withIndex("by_site", (q) => q.eq("siteId", siteId))
          .order("desc")
          .take(100);
    return rows.map((n) => ({
      id: n._id,
      path: n.path,
      url: n.url,
      title: n.title ?? null,
      selector: n.selector,
      elementText: n.elementText,
      note: n.note,
      viewport: n.viewport ?? null,
      status: n.status,
      triage: n.triage ?? null,
      createdAt: n.createdAt,
    }));
  },
});

export const setNoteStatus = mutation({
  args: { noteId: v.id("notes"), status: v.union(v.literal("new"), v.literal("done"), v.literal("dismissed")) },
  handler: async (ctx, { noteId, status }) => {
    const note = await ctx.db.get(noteId);
    if (!note) throw new Error("That note is gone.");
    const { site } = await ownedSite(ctx, note.siteId);
    if (note.status === status) return;
    const delta = (note.status === "new" ? -1 : 0) + (status === "new" ? 1 : 0);
    await ctx.db.patch(note._id, { status });
    if (delta) await ctx.db.patch(site._id, { open: Math.max(0, site.open + delta) });
  },
});

/** Called by the /ask/note HTTP endpoint after shape validation. Origin is the fence. */
export const ingest = internalMutation({
  args: {
    origin: v.string(),
    note: v.object({
      key: v.string(),
      url: v.string(),
      path: v.string(),
      title: v.optional(v.string()),
      selector: v.string(),
      elementText: v.string(),
      html: v.string(),
      note: v.string(),
      viewport: v.optional(v.string()),
    }),
  },
  handler: async (
    ctx,
    { origin, note },
  ): Promise<{ ok: true; status: 200 } | { ok: false; error: string; status: number }> => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_key", (q) => q.eq("key", note.key))
      .unique();
    if (!site) return { ok: false, error: "unknown site key", status: 404 };
    if (site.origin !== normalizeOrigin(origin)) return { ok: false, error: "this key belongs to another site", status: 403 };
    const g = await rateLimiter.limit(ctx, "notesGlobal", { key: "global" });
    if (!g.ok) return { ok: false, error: "busy, try again later", status: 429 };
    const s = await rateLimiter.limit(ctx, "siteNote", { key: site.key });
    if (!s.ok) return { ok: false, error: "this site has had a lot of notes today", status: 429 };
    const now = Date.now();
    const id = await ctx.db.insert("notes", {
      siteId: site._id,
      url: note.url,
      path: note.path,
      title: note.title,
      selector: note.selector,
      elementText: note.elementText,
      html: note.html,
      note: note.note,
      viewport: note.viewport,
      status: "new",
      createdAt: now,
    });
    await ctx.db.patch(site._id, { notes: site.notes + 1, open: site.open + 1, lastNoteAt: now });
    await ctx.scheduler.runAfter(0, internal.sitesTriage.run, { noteId: id });
    return { ok: true, status: 200 };
  },
});

export const getNote = internalQuery({
  args: { noteId: v.id("notes") },
  handler: async (ctx, { noteId }) => {
    const note = await ctx.db.get(noteId);
    if (!note) return null;
    const site = await ctx.db.get(note.siteId);
    if (!site) return null;
    return { note: { note: note.note, elementText: note.elementText, path: note.path }, site: { name: site.name } };
  },
});

export const setTriage = internalMutation({
  args: { noteId: v.id("notes"), triage: v.object({ kind: v.string(), summary: v.string(), model: v.string() }) },
  handler: async (ctx, { noteId, triage }) => {
    const note = await ctx.db.get(noteId);
    if (note) await ctx.db.patch(noteId, { triage });
  },
});
