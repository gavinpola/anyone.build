import type { BlockMeta, CanvasMeta } from "@/kit";

/**
 * The bounded canvas: a fixed world (in px at zoom 1) that you zoom and pan inside a viewport. Pure
 * geometry so it's the same for everyone and testable without a browser.
 */
export type World = { w: number; h: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type Pan = { x: number; y: number };

export const WORLD_DEFAULT: World = { w: 2400, h: 1600 };
export const ZOOM_MAX = 1.6;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function worldSize(c: CanvasMeta): World {
  return { w: clamp(Math.round(c.size?.w ?? WORLD_DEFAULT.w), 800, 8000), h: clamp(Math.round(c.size?.h ?? WORLD_DEFAULT.h), 600, 12000) };
}

/** The zoom at which the whole world fits the viewport (never above 1: the overview is a map, not a magnifier). */
export function fitZoom(viewport: { w: number; h: number }, world: World): number {
  if (viewport.w <= 0 || viewport.h <= 0) return 1;
  return clamp(Math.min(viewport.w / world.w, viewport.h / world.h), 0.05, 1);
}

export function clampZoom(z: number, fit: number): number {
  return clamp(z, Math.min(fit, 1), ZOOM_MAX);
}

/** Keep the world on screen: never pan it fully out of the viewport; centre it when it's smaller. */
export function clampPan(pan: Pan, zoom: number, viewport: { w: number; h: number }, world: World): Pan {
  const ww = world.w * zoom;
  const wh = world.h * zoom;
  const x = ww <= viewport.w ? (viewport.w - ww) / 2 : clamp(pan.x, viewport.w - ww, 0);
  const y = wh <= viewport.h ? (viewport.h - wh) / 2 : clamp(pan.y, viewport.h - wh, 0);
  return { x, y };
}

/** Zoom around a viewport point so the world under the pointer stays put. */
export function zoomAround(point: { x: number; y: number }, from: { pan: Pan; zoom: number }, to: number): Pan {
  const k = to / from.zoom;
  return { x: point.x - (point.x - from.pan.x) * k, y: point.y - (point.y - from.pan.y) * k };
}

export function toWorld(client: { x: number; y: number }, viewportRect: { left: number; top: number }, pan: Pan, zoom: number): { x: number; y: number } {
  return { x: (client.x - viewportRect.left - pan.x) / zoom, y: (client.y - viewportRect.top - pan.y) / zoom };
}

export type PackItem = { id: string; w: number; h: number; place?: BlockMeta["place"] | undefined; order: number };
export type Placed = { id: string; x: number; y: number; w: number; h: number; pinned: boolean };

/**
 * Where everything sits. Blocks with an explicit `place` stay exactly there (clamped to the world).
 * The rest are packed left-to-right, top-to-bottom into the free space with a skyline, in `order`,
 * so nothing overlaps and the wall reads like a wall, not a pile. Heights come from measurement
 * (or an estimate before the first paint). Returns positions and the bottom edge of the content.
 */
export function packBlocks(items: PackItem[], world: World, gap: number, padding: number, gapY: number = gap): { placed: Placed[]; bottom: number } {
  const pinned: Placed[] = [];
  const free: PackItem[] = [];
  for (const it of items) {
    if (it.place && Number.isFinite(it.place.x) && Number.isFinite(it.place.y) && Number.isFinite(it.place.w)) {
      const w = clamp(it.place.w, 120, world.w - 2 * padding);
      pinned.push({ id: it.id, x: clamp(it.place.x, padding, world.w - padding - w), y: clamp(it.place.y, padding, world.h * 4), w, h: it.h, pinned: true });
    } else free.push(it);
  }
  free.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const out: Placed[] = [...pinned];
  const overlaps = (r: Rect) => out.some((p) => r.x < p.x + p.w + gap && r.x + r.w + gap > p.x && r.y < p.y + p.h + gapY && r.y + r.h + gapY > p.y);
  const usable = world.w - 2 * padding;
  for (const it of free) {
    const w = clamp(it.w, 120, usable);
    // candidate rows: the top, and just below every existing block; within a row, the leftmost fit
    const ys = Array.from(new Set([padding, ...out.map((p) => p.y + p.h + gapY)])).sort((a, b) => a - b);
    let spot: Rect | null = null;
    for (const y of ys) {
      const xs = Array.from(new Set([padding, ...out.map((p) => p.x + p.w + gap)])).filter((x) => x + w <= padding + usable).sort((a, b) => a - b);
      for (const x of xs) {
        const r = { x, y, w, h: it.h };
        if (!overlaps(r)) {
          spot = r;
          break;
        }
      }
      if (spot) break;
    }
    if (!spot) spot = { x: padding, y: Math.max(padding, ...out.map((p) => p.y + p.h + gapY)), w, h: it.h };
    out.push({ id: it.id, ...spot, pinned: false });
  }
  const bottom = out.reduce((m, p) => Math.max(m, p.y + p.h), 0);
  return { placed: out, bottom };
}

/**
 * A width in world px from a block's meta. Sizes are card widths (a note, a widget, a game, a big
 * piece), not fractions of the world: the world is a board, and a "full" card is a big card, not a
 * banner across it. An explicit `span` is 1..12 twelfths of the world for people who want that.
 */
export const CARD_WIDTHS = { sm: 360, md: 520, lg: 760, full: 1120 } as const;
export function widthFor(meta: Pick<BlockMeta, "size" | "span">, world: World, padding: number, gap: number): number {
  const usable = world.w - 2 * padding;
  if (meta.span != null) {
    const span = clamp(Math.round(meta.span), 1, 12);
    return Math.round((usable + gap) * (span / 12) - gap);
  }
  return clamp(CARD_WIDTHS[meta.size ?? "md"] ?? CARD_WIDTHS.md, 120, usable);
}

/** A region on the canvas, as the words the judge and coder read: "region x,y,w,h · contains: a, b". */
export function regionText(r: Rect, contains: string[]): string {
  const base = `region ${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.w)},${Math.round(r.h)}`;
  const c = contains.length ? ` · contains: ${contains.join(", ")}` : "";
  return (base + c).slice(0, 120);
}

export function parseRegion(text: string | undefined): Rect | null {
  const m = text?.match(/^region (\d+),(\d+),(\d+),(\d+)/);
  return m ? { x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) } : null;
}

export function pointText(p: { x: number; y: number }): string {
  return `here ${Math.round(p.x)},${Math.round(p.y)}`;
}

export function parsePoint(text: string | undefined): { x: number; y: number } | null {
  const m = text?.match(/^here (\d+),(\d+)/);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
}

/** Decay: how long a block has left, given the canvas window in days. null = never fades. */
export function lifeLeft(opts: { decayDays: number | false | undefined; pinned?: boolean; lastTouchedAt: number | null; fallback: number; now: number }): { left: number | null; window: number } {
  const days = opts.decayDays === false || opts.decayDays == null ? 0 : Math.max(0, Math.min(365, opts.decayDays));
  const window = days * 24 * 60 * 60 * 1000;
  if (!days || opts.pinned) return { left: null, window };
  const since = opts.lastTouchedAt ?? opts.fallback;
  return { left: window - (opts.now - since), window };
}

