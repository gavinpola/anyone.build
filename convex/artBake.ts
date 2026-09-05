"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Resvg } from "@resvg/resvg-js";

/**
 * Bake a whiteboard namespace to a PNG. Runs every minute; skips when nothing changed. A stroke is
 * { color, width, points: [{x, y}] } in a 960×420 space (the open canvas block's own convention).
 * The picture lets every viewer at the overview see the canvas without a live subscription to the
 * stroke list, which is what makes the wall cheap to watch with thousands of tabs open.
 */
const W = 960;
const H = 420;

type Stroke = { color?: string; width?: number; points?: Array<{ x: number; y: number }> };

function esc(s: string): string {
  return s.replace(/[^#a-zA-Z0-9(),.% ]/g, "");
}

export function strokesToSvg(strokes: Stroke[]): string {
  const parts: string[] = [];
  for (const s of strokes) {
    const pts = (s.points ?? []).filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y));
    if (pts.length === 0) continue;
    const color = esc(String(s.color ?? "#ffffff")).slice(0, 24) || "#ffffff";
    const w = Math.max(1, Math.min(80, Number(s.width) || 4));
    if (pts.length === 1) parts.push(`<circle cx="${pts[0]!.x.toFixed(1)}" cy="${pts[0]!.y.toFixed(1)}" r="${(w / 2).toFixed(1)}" fill="${color}"/>`);
    else parts.push(`<polyline points="${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`);
  }
  const grid: string[] = [];
  for (let x = 48; x < W; x += 48) grid.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="rgba(255,255,255,0.035)" stroke-width="1"/>`);
  for (let y = 48; y < H; y += 48) grid.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="rgba(255,255,255,0.035)" stroke-width="1"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#0d0b09"/>${grid.join("")}${parts.join("")}</svg>`;
}

type Doc = { key: string; value: unknown; by: string | null; at: number };
type BakeResult = { baked: boolean; reason?: string; count?: number; bytes?: number };

export const bake = internalAction({
  args: { namespace: v.string() },
  handler: async (ctx, { namespace }): Promise<BakeResult> => {
    const docs: Doc[] = await ctx.runQuery(api.store.list, { namespace, limit: 500 });
    const newestDocAt = docs.reduce((m: number, d: Doc) => Math.max(m, d.at), 0);
    const state = await ctx.runQuery(api.art.bakeState, { namespace });
    if (state && state.newestDocAt === newestDocAt && state.count === docs.length) return { baked: false, reason: "unchanged" };
    // oldest first so newer strokes paint on top
    const strokes = [...docs].reverse().map((d) => d.value as Stroke);
    const svg = strokesToSvg(strokes);
    const png = new Resvg(svg, { fitTo: { mode: "width", value: W } }).render().asPng();
    const storageId = await ctx.storage.store(new Blob([new Uint8Array(png)], { type: "image/png" }));
    await ctx.runMutation(internal.art.record, { namespace, storageId, count: docs.length, bytes: png.length, newestDocAt });
    return { baked: true, count: docs.length, bytes: png.length };
  },
});
