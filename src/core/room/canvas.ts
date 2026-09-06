import type { BlockMeta, CanvasMeta } from "@/kit";

/**
 * The walkable world. The unit is a tile, not a pixel: a tile is one phone width, the world renders at
 * 100% always, and you walk it (drag the ground, swipe, arrow keys). Blocks occupy whole tiles (1 or 2
 * wide, 1 to 3 tall from their measured height) and the world is unbounded: it packs outward from
 * 0,0 and there is no edge to zoom out to. Pure geometry so it is the same for everyone and testable
 * without a browser.
 */
export const TILE_W = 360; // one phone width
export const TILE_H = 220; // a card and its label; games take two
/** The gutter inside a tile: a block's box is its tiles minus this on every side. */
export const GUTTER = 16;
/** Room above a block's box for its label (who · what · size). */
export const LABEL_H = 24;
export const MAX_TILES_WIDE = 2;
export const MAX_TILES_TALL = 3;
/** How far from the content the camera may wander, in tiles: the frontier is where you add things. */
export const FRONTIER = 1;

export type Tile = { x: number; y: number };
export type TileRect = { x: number; y: number; w: number; h: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type Cam = { x: number; y: number };
export type World = { w: number; h: number };

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Pixels → the tile under that point. */
export function tileAt(px: { x: number; y: number }): Tile {
  return { x: Math.floor(px.x / TILE_W), y: Math.floor(px.y / TILE_H) };
}

/** A block's box in world px: its tiles minus the gutter, with the label's room taken off the top. */
export function tileBox(r: TileRect): Rect {
  return { x: r.x * TILE_W + GUTTER, y: r.y * TILE_H + GUTTER + LABEL_H, w: r.w * TILE_W - 2 * GUTTER, h: r.h * TILE_H - 2 * GUTTER - LABEL_H };
}

/** The whole tile rectangle in world px (the ground a block owns). */
export function tileGround(r: TileRect): Rect {
  return { x: r.x * TILE_W, y: r.y * TILE_H, w: r.w * TILE_W, h: r.h * TILE_H };
}

/** How many tiles tall a block of this measured height is (1..3). */
export function tilesTall(measuredPx: number): number {
  return clamp(Math.ceil((measuredPx + 2 * GUTTER + LABEL_H) / TILE_H), 1, MAX_TILES_TALL);
}

/**
 * How many tiles wide a block is from its meta: sm and md are one tile, lg and full are two. An explicit
 * `span` (legacy, 1..12 columns) is two tiles when it is more than half the old grid.
 */
export function tilesWide(meta: Pick<BlockMeta, "size" | "span">): number {
  if (meta.span != null) return meta.span > 6 ? 2 : 1;
  return meta.size === "lg" || meta.size === "full" ? 2 : 1;
}

/**
 * A block's own place, in tiles. Legacy places were world pixels ({ x, y, w } on a 2400 × 1600 board):
 * anything too big to be a tile coordinate is read as pixels and migrated (tx = round(x / 360)).
 */
export function placeOf(place: BlockMeta["place"] | undefined): TileRect | null {
  if (!place || !Number.isFinite(place.x) || !Number.isFinite(place.y)) return null;
  const legacy = Math.abs(place.x) > 60 || Math.abs(place.y) > 60 || (place.w != null && place.w > 8);
  const x = legacy ? Math.round(place.x / TILE_W) : Math.round(place.x);
  const y = legacy ? Math.round(place.y / TILE_H) : Math.round(place.y);
  const w = place.w == null || !Number.isFinite(place.w) ? 1 : legacy ? Math.round(place.w / TILE_W) : Math.round(place.w);
  const h = place.h == null || !Number.isFinite(place.h) ? undefined : Math.round(place.h);
  return { x: clamp(x, -500, 500), y: clamp(y, -500, 500), w: clamp(w, 1, MAX_TILES_WIDE), h: h == null ? 0 : clamp(h, 1, MAX_TILES_TALL) };
}

export type PackItem = { id: string; w: number; h: number; place?: BlockMeta["place"] | undefined; order: number };
export type Placed = TileRect & { id: string; pinned: boolean };

const key = (x: number, y: number) => `${x},${y}`;

function cells(r: TileRect): string[] {
  const out: string[] = [];
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) out.push(key(x, y));
  return out;
}

/**
 * Candidate top-left tiles for a w × h block within `radius` tiles of the origin, nearest first: the block
 * whose centre is closest to the middle of tile 0,0 wins; ties go to the smaller column, then the higher
 * row, then the right and the bottom. Deterministic, so the world is the same for everyone.
 */
function candidates(w: number, h: number, radius: number): Tile[] {
  const out: Array<Tile & { d: number }> = [];
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      const cx = x + w / 2 - 0.5;
      const cy = y + h / 2 - 0.5;
      out.push({ x, y, d: cx * cx + cy * cy * 1.3 }); // rows are cheaper than columns: the world reads wider than tall
    }
  }
  out.sort((a, b) => a.d - b.d || Math.abs(a.x) - Math.abs(b.x) || Math.abs(a.y) - Math.abs(b.y) || b.x - a.x || b.y - a.y);
  return out;
}

/**
 * Where everything sits. Blocks with a `place` sit exactly there (a placed block that overlaps another
 * placed one is nudged to the nearest free spot, later order first). The rest are packed outward from
 * 0,0 in `order`, into the nearest free tiles, so nothing overlaps and the world grows at its edges.
 * Heights come from measurement (or an estimate before the first paint).
 */
export function packTiles(items: PackItem[]): Placed[] {
  const taken = new Set<string>();
  const out: Placed[] = [];
  const fits = (r: TileRect) => cells(r).every((c) => !taken.has(c));
  const take = (r: TileRect) => {
    for (const c of cells(r)) taken.add(c);
  };
  const nearest = (w: number, h: number, from?: Tile): TileRect => {
    for (const radius of [6, 16, 40, 80]) {
      for (const c of candidates(w, h, radius)) {
        const r = { x: (from?.x ?? 0) + c.x, y: (from?.y ?? 0) + c.y, w, h };
        if (fits(r)) return r;
      }
    }
    return { x: 0, y: 81 + out.length, w, h }; // 25,000+ blocks: fall off the bottom rather than loop forever
  };
  const pinned = items.filter((it) => placeOf(it.place)).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const free = items.filter((it) => !placeOf(it.place)).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  for (const it of pinned) {
    const p = placeOf(it.place)!;
    const want = { x: p.x, y: p.y, w: clamp(Math.round(it.w || p.w), 1, MAX_TILES_WIDE), h: p.h || clamp(Math.round(it.h), 1, MAX_TILES_TALL) };
    const r = fits(want) ? want : nearest(want.w, want.h, { x: want.x, y: want.y });
    take(r);
    out.push({ id: it.id, ...r, pinned: true });
  }
  for (const it of free) {
    const r = nearest(clamp(Math.round(it.w), 1, MAX_TILES_WIDE), clamp(Math.round(it.h), 1, MAX_TILES_TALL));
    take(r);
    out.push({ id: it.id, ...r, pinned: false });
  }
  return out;
}

/** The tiles the content covers, plus the frontier around it: the known world. Never smaller than 3 × 3 around the origin. */
export function worldBounds(placed: TileRect[], frontier = FRONTIER): TileRect {
  let x0 = -1;
  let y0 = -1;
  let x1 = 1;
  let y1 = 1;
  for (const p of placed) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x + p.w - 1);
    y1 = Math.max(y1, p.y + p.h - 1);
  }
  return { x: x0 - frontier, y: y0 - frontier, w: x1 - x0 + 1 + 2 * frontier, h: y1 - y0 + 1 + 2 * frontier };
}

/** Is this tile free (no block's tiles cover it)? */
export function isFree(t: Tile, placed: TileRect[]): boolean {
  return !placed.some((p) => t.x >= p.x && t.x < p.x + p.w && t.y >= p.y && t.y < p.y + p.h);
}

/** The block covering a tile, if any. */
export function blockAtTile<T extends TileRect>(t: Tile, placed: T[]): T | null {
  return placed.find((p) => t.x >= p.x && t.x < p.x + p.w && t.y >= p.y && t.y < p.y + p.h) ?? null;
}

/**
 * The free tile nearest a point (in tiles, fractional), within the known world; null if the world is full.
 * With `within` (a rectangle in tiles, fractional: the screen), a free tile wholly inside it wins over a
 * nearer one that is cut off, so the add zone is something you can see and tap.
 */
export function nearestFreeTile(from: { x: number; y: number }, placed: TileRect[], bounds: TileRect, within?: { x: number; y: number; w: number; h: number }): Tile | null {
  let best: Tile | null = null;
  let bd = Infinity;
  for (let y = bounds.y; y < bounds.y + bounds.h; y++) {
    for (let x = bounds.x; x < bounds.x + bounds.w; x++) {
      if (!isFree({ x, y }, placed)) continue;
      // whole on screen first, then at least its middle (so it can be tapped), then anything
      const whole = !within || (x >= within.x && x + 1 <= within.x + within.w && y >= within.y && y + 1 <= within.y + within.h);
      const middle = !within || (x + 0.5 >= within.x && x + 0.5 <= within.x + within.w && y + 0.5 >= within.y && y + 0.5 <= within.y + within.h);
      const d = (x + 0.5 - from.x) ** 2 + (y + 0.5 - from.y) ** 2 + (whole ? 0 : middle ? 1e5 : 1e6);
      if (d < bd) {
        bd = d;
        best = { x, y };
      }
    }
  }
  return best;
}

/** The camera that puts a world point at the centre of the viewport. */
export function camCentredOn(px: { x: number; y: number }, viewport: World): Cam {
  return { x: px.x - viewport.w / 2, y: px.y - viewport.h / 2 };
}

/** The camera that centres a tile rectangle (a block, or one tile). */
export function camForTiles(r: TileRect, viewport: World): Cam {
  const g = tileGround(r);
  return camCentredOn({ x: g.x + g.w / 2, y: g.y + g.h / 2 }, viewport);
}

/**
 * Keep the camera over the known world: you can walk until the frontier's last tile is in the middle of
 * your screen, never further into nothing. A viewport wider than the world centres it.
 */
export function clampCam(cam: Cam, viewport: World, bounds: TileRect): Cam {
  const g = tileGround(bounds);
  const sx = Math.max(0, (viewport.w - TILE_W) / 2); // the slack that lets an edge tile sit in the middle
  const sy = Math.max(0, (viewport.h - TILE_H) / 2);
  const x = g.w <= viewport.w ? g.x + (g.w - viewport.w) / 2 : clamp(cam.x, g.x - sx, g.x + g.w - viewport.w + sx);
  const y = g.h <= viewport.h ? g.y + (g.h - viewport.h) / 2 : clamp(cam.y, g.y - sy, g.y + g.h - viewport.h + sy);
  return { x: Math.round(x), y: Math.round(y) };
}

/** Client → world px, with the camera. */
export function toWorld(client: { x: number; y: number }, viewportRect: { left: number; top: number }, cam: Cam): { x: number; y: number } {
  return { x: client.x - viewportRect.left + cam.x, y: client.y - viewportRect.top + cam.y };
}

/** The tile under the middle of the viewport: where you are. */
export function tileOfView(cam: Cam, viewport: World): Tile {
  return tileAt({ x: cam.x + viewport.w / 2, y: cam.y + viewport.h / 2 });
}

/** The tiles a rectangle of world px covers. */
export function tilesCovering(r: Rect): TileRect {
  const a = tileAt({ x: r.x, y: r.y });
  const b = tileAt({ x: r.x + Math.max(0, r.w - 1), y: r.y + Math.max(0, r.h - 1) });
  return { x: a.x, y: a.y, w: b.x - a.x + 1, h: b.y - a.y + 1 };
}

/** A tile as the words the judge and coder read: "tile 4,-2". */
export function tileText(t: Tile): string {
  return `tile ${Math.round(t.x)},${Math.round(t.y)}`;
}

/** A run of tiles: "tiles 4,-2→5,-1 · contains: a, b". The second pair is the last tile, inclusive. */
export function tilesText(r: TileRect, contains: string[]): string {
  const base = `tiles ${r.x},${r.y}→${r.x + r.w - 1},${r.y + r.h - 1}`;
  const c = contains.length ? ` · contains: ${contains.join(", ")}` : "";
  return (base + c).slice(0, 120);
}

/** The tile a target text names, if it names one ("tile X,Y", or the legacy "here X,Y" in world px). */
export function parseTile(text: string | undefined): Tile | null {
  const m = text?.match(/^tile (-?\d+),(-?\d+)/);
  if (m) return { x: Number(m[1]), y: Number(m[2]) };
  const legacy = text?.match(/^here (\d+),(\d+)/);
  return legacy ? tileAt({ x: Number(legacy[1]), y: Number(legacy[2]) }) : null;
}

/** The tiles a target text names, if it names a run ("tiles X,Y→X2,Y2", or the legacy "region X,Y,W,H" in world px). */
export function parseTiles(text: string | undefined): TileRect | null {
  const m = text?.match(/^tiles (-?\d+),(-?\d+)→(-?\d+),(-?\d+)/);
  if (m) {
    const x0 = Math.min(Number(m[1]), Number(m[3]));
    const y0 = Math.min(Number(m[2]), Number(m[4]));
    return { x: x0, y: y0, w: Math.abs(Number(m[3]) - Number(m[1])) + 1, h: Math.abs(Number(m[4]) - Number(m[2])) + 1 };
  }
  const legacy = text?.match(/^region (\d+),(\d+),(\d+),(\d+)/);
  return legacy ? tilesCovering({ x: Number(legacy[1]), y: Number(legacy[2]), w: Number(legacy[3]), h: Number(legacy[4]) }) : null;
}

/** "4,-2" ↔ a tile, for the /t/4,-2 deep link. */
export function tileFromPath(s: string | undefined): Tile | null {
  const m = s?.match(/^(-?\d{1,3}),(-?\d{1,3})$/);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
}

export function tilePath(t: Tile): string {
  return `/t/${Math.round(t.x)},${Math.round(t.y)}`;
}

/** Decay: how long a block has left, given the canvas window in days. null = never fades. */
export function lifeLeft(opts: { decayDays: number | false | undefined; pinned?: boolean; lastTouchedAt: number | null; fallback: number; now: number }): { left: number | null; window: number } {
  const days = opts.decayDays === false || opts.decayDays == null ? 0 : Math.max(0, Math.min(365, opts.decayDays));
  const window = days * 24 * 60 * 60 * 1000;
  if (!days || opts.pinned) return { left: null, window };
  const since = opts.lastTouchedAt ?? opts.fallback;
  return { left: window - (opts.now - since), window };
}

/**
 * Where you land. Never top-left, never fit-all: the newest block, or the hottest one if the newest is
 * over six hours old, or (a cold world) the block with the most neighbours so the first screen is full.
 */
export function spawnTile(opts: { placed: Placed[]; lastAt: Record<string, number | null | undefined>; heat: Record<string, number | undefined>; now: number }): Tile {
  const { placed } = opts;
  if (!placed.length) return { x: 0, y: 0 };
  const byId = new Map(placed.map((p) => [p.id, p]));
  const centre = (p: TileRect): Tile => ({ x: p.x + Math.floor((p.w - 1) / 2), y: p.y + Math.floor((p.h - 1) / 2) });
  let newest: { id: string; at: number } | null = null;
  for (const [id, at] of Object.entries(opts.lastAt)) if (at && byId.has(id) && (!newest || at > newest.at)) newest = { id, at };
  if (newest && opts.now - newest.at < 6 * 60 * 60 * 1000) return centre(byId.get(newest.id)!);
  let hottest: { id: string; heat: number } | null = null;
  for (const [id, heat] of Object.entries(opts.heat)) if (heat && byId.has(id) && (!hottest || heat > hottest.heat)) hottest = { id, heat };
  if (hottest) return centre(byId.get(hottest.id)!);
  if (newest) return centre(byId.get(newest.id)!);
  // the densest cluster: the block with the most other blocks within a tile of it
  let best = placed[0]!;
  let bn = -1;
  for (const p of placed) {
    const n = placed.filter((q) => q !== p && q.x < p.x + p.w + 1 && q.x + q.w > p.x - 1 && q.y < p.y + p.h + 1 && q.y + q.h > p.y - 1).length;
    if (n > bn || (n === bn && p.id < best.id)) {
      bn = n;
      best = p;
    }
  }
  return centre(best);
}

/** Legacy: the old bounded board's size, still read by the paper skin's liquid layer for its canvas. */
export function worldSize(c: CanvasMeta): World {
  return { w: clamp(Math.round(c.size?.w ?? 2400), 800, 8000), h: clamp(Math.round(c.size?.h ?? 1600), 600, 12000) };
}
