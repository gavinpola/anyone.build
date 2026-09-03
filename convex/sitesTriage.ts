"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { triageNote } from "../packages/gatekeeper/src/index";

/** Labels a visitor's note with one cheap model call. Silent when there's no key or the model fails. */
export const run = internalAction({
  args: { noteId: v.id("notes") },
  handler: async (ctx, { noteId }) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return;
    const data = await ctx.runQuery(internal.sites.getNote, { noteId });
    if (!data) return;
    const model = process.env.TRIAGE_MODEL ?? "google/gemini-2.5-flash-lite";
    try {
      const { triage } = await triageNote(
        { apiKey, baseURL: process.env.MODEL_BASE_URL || undefined, model },
        { note: data.note.note, elementText: data.note.elementText, path: data.note.path, siteName: data.site.name },
      );
      await ctx.runMutation(internal.sites.setTriage, { noteId, triage: { ...triage, model } });
    } catch (e) {
      console.warn("triage skipped:", (e instanceof Error ? e.message : String(e)).slice(0, 200));
    }
  },
});
