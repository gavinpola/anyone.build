import { describe, expect, it } from "vitest";
import {
  TILE_H,
  TILE_W,
  camForTiles,
  clampCam,
  isFree,
  lifeLeft,
  nearestFreeTile,
  packTiles,
  parseTile,
  parseTiles,
  placeOf,
  spawnTile,
  tileAt,
  tileBox,
  tileFromPath,
  tileOfView,
  tilePath,
  tileText,
  tilesCovering,
  tilesTall,
  tilesText,
  tilesWide,
  toWorld,
  worldBounds,
} from "../../src/core/room/canvas";

describe("tiles: the world's unit", () => {
  it("a tile is a phone width; a block's box is its tiles minus the gutter and its label's room", () => {
    expect(TILE_W).toBe(360);
    expect(tileAt({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(tileAt({ x: -1, y: -1 })).toEqual({ x: -1, y: -1 });
    expect(tileAt({ x: 725, y: 439 })).toEqual({ x: 2, y: 1 });
    const b = tileBox({ x: 1, y: 1, w: 2, h: 1 });
    expect(b.x).toBe(TILE_W + 16);
    expect(b.w).toBe(2 * TILE_W - 32);
    expect(b.h).toBe(TILE_H - 32 - 24);
  });
  it("sizes map to tiles: sm/md one wide, lg/full two; height from the content, one to three", () => {
    expect(tilesWide({ size: "sm" })).toBe(1);
    expect(tilesWide({ size: "md" })).toBe(1);
    expect(tilesWide({ size: "lg" })).toBe(2);
    expect(tilesWide({ size: "full" })).toBe(2);
    expect(tilesWide({ size: "sm", span: 9 })).toBe(2);
    expect(tilesTall(100)).toBe(1);
    expect(tilesTall(300)).toBe(2);
    expect(tilesTall(9000)).toBe(4); // the cap; taller content is clipped by the body
  });
  it("reads a place in tiles, and migrates an old pixel place", () => {
    expect(placeOf({ x: 4, y: -2 })).toEqual({ x: 4, y: -2, w: 1, h: 0 });
    expect(placeOf({ x: 3, y: 2, w: 2, h: 2 })).toEqual({ x: 3, y: 2, w: 2, h: 2 });
    expect(placeOf({ x: 900, y: 520, w: 560 })).toEqual({ x: 3, y: 2, w: 2, h: 0 }); // the old board's pixels
    expect(placeOf({ x: 1, y: 1, w: 7 })).toEqual({ x: 1, y: 1, w: 2, h: 0 }); // never wider than two
    expect(placeOf(undefined)).toBeNull();
    expect(placeOf({ x: NaN, y: 1 })).toBeNull();
  });
});

describe("packing blocks into the world", () => {
  const item = (id: string, w: number, h: number, order = 0, place?: { x: number; y: number; w?: number; h?: number }) => ({ id, w, h, order, place });
  const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  it("never overlaps, keeps explicit places, and packs outward from the origin", () => {
    const items = [item("a", 2, 1, 0), item("b", 1, 1, 1), item("c", 1, 2, 2), item("d", 2, 2, 3, { x: 3, y: 2 }), item("e", 1, 1, 4)];
    const placed = packTiles(items);
    expect(placed).toHaveLength(5);
    for (const p of placed) for (const q of placed) if (p.id !== q.id) expect(overlaps(p, q), `${p.id} overlaps ${q.id}`).toBe(false);
    const by = Object.fromEntries(placed.map((p) => [p.id, p]));
    expect(by.d).toMatchObject({ x: 3, y: 2, w: 2, h: 2, pinned: true });
    expect(by.a).toMatchObject({ x: 0, y: 0, w: 2, h: 1 }); // the first block starts at the origin
    // everything unplaced sits within a couple of tiles of the origin
    for (const id of ["a", "b", "c", "e"]) expect(Math.max(Math.abs(by[id]!.x), Math.abs(by[id]!.y))).toBeLessThanOrEqual(2);
  });
  it("is deterministic, and a placed block that lands on another placed one is nudged to the nearest free tiles", () => {
    const items = [item("x", 1, 1, 0, { x: 0, y: 0 }), item("y", 1, 1, 1, { x: 0, y: 0 }), item("z", 2, 1, 2)];
    const a = packTiles(items);
    const b = packTiles(items);
    expect(a).toEqual(b);
    const by = Object.fromEntries(a.map((p) => [p.id, p]));
    expect(by.x).toMatchObject({ x: 0, y: 0 });
    expect(by.y!.x === 0 && by.y!.y === 0).toBe(false);
    expect(Math.abs(by.y!.x) + Math.abs(by.y!.y)).toBe(1); // right next door
  });
  it("the known world is the content plus a frontier, never smaller than three by three", () => {
    expect(worldBounds([])).toEqual({ x: -2, y: -2, w: 5, h: 5 });
    const b = worldBounds([{ x: 3, y: 2, w: 2, h: 2 }]);
    expect(b).toEqual({ x: -2, y: -2, w: 8, h: 7 });
    expect(isFree({ x: 3, y: 2 }, [{ x: 3, y: 2, w: 2, h: 2 }])).toBe(false);
    expect(isFree({ x: 5, y: 2 }, [{ x: 3, y: 2, w: 2, h: 2 }])).toBe(true);
    const n = nearestFreeTile({ x: 3.5, y: 2.5 }, [{ x: 3, y: 2, w: 2, h: 2 }], b)!;
    expect(Math.abs(n.x - 3) + Math.abs(n.y - 2)).toBe(1); // right next door to the taken tile
  });
});

describe("the camera", () => {
  const vp = { w: 1440, h: 800 };
  it("centres a tile, and never wanders past the frontier", () => {
    const cam = camForTiles({ x: 0, y: 0, w: 1, h: 1 }, vp);
    expect(cam).toEqual({ x: TILE_W / 2 - 720, y: TILE_H / 2 - 400 });
    const bounds = { x: -2, y: -2, w: 5, h: 5 }; // 1800 × 1100 px: wider than the screen, taller too
    // as far as the frontier's edge tile sitting in the middle of the screen, no further
    expect(clampCam({ x: -99999, y: 99999 }, vp, bounds)).toEqual({ x: -2 * TILE_W - (1440 - TILE_W) / 2, y: 3 * TILE_H - 800 + (800 - TILE_H) / 2 });
    expect(tileOfView(clampCam(camForTiles({ x: 2, y: 2, w: 1, h: 1 }, vp), vp, bounds), vp)).toEqual({ x: 2, y: 2 });
    // a world narrower than the screen is centred
    expect(clampCam({ x: 500, y: 0 }, { w: 4000, h: 800 }, bounds).x).toBe(-2 * TILE_W + (5 * TILE_W - 4000) / 2);
  });
  it("client points map through the camera, and the middle of the screen is where you are", () => {
    const cam = { x: 100, y: 50 };
    expect(toWorld({ x: 210, y: 120 }, { left: 10, top: 20 }, cam)).toEqual({ x: 300, y: 150 });
    expect(tileOfView({ x: 4 * TILE_W - 720, y: -2 * TILE_H - 400 }, vp)).toEqual({ x: 4, y: -2 });
  });
});

describe("tiles as words", () => {
  it("round-trip through the text the judge reads, and read the old pixel texts too", () => {
    expect(tileText({ x: 4, y: -2 })).toBe("tile 4,-2");
    expect(parseTile("tile 4,-2")).toEqual({ x: 4, y: -2 });
    expect(parseTile("here 900,520")).toEqual({ x: 2, y: 2 }); // legacy pixels
    expect(parseTile("nothing")).toBeNull();
    const t = tilesText({ x: 4, y: 0, w: 2, h: 1 }, ["hello-note", "electric-message"]);
    expect(t).toBe("tiles 4,0→5,0 · contains: hello-note, electric-message");
    expect(parseTiles(t)).toEqual({ x: 4, y: 0, w: 2, h: 1 });
    expect(parseTiles("tiles 5,1→4,0")).toEqual({ x: 4, y: 0, w: 2, h: 2 });
    expect(parseTiles("region 120,80,640,400")).toEqual({ x: 0, y: 0, w: 3, h: 3 }); // legacy pixels
    expect(tilesText({ x: 0, y: 0, w: 1, h: 1 }, Array.from({ length: 40 }, (_, i) => `block-${i}`)).length).toBeLessThanOrEqual(120);
    expect(tilesCovering({ x: 10, y: 10, w: 700, h: 100 })).toEqual({ x: 0, y: 0, w: 2, h: 1 });
  });
  it("deep links keep their tile", () => {
    expect(tilePath({ x: 4, y: -2 })).toBe("/t/4,-2");
    expect(tileFromPath("4,-2")).toEqual({ x: 4, y: -2 });
    expect(tileFromPath("x,y")).toBeNull();
    expect(tileFromPath("1000,0")).toBeNull();
  });
});

describe("where you land", () => {
  const placed = [
    { id: "a", x: 0, y: 0, w: 2, h: 1, pinned: false },
    { id: "b", x: -1, y: 1, w: 1, h: 1, pinned: false },
    { id: "c", x: 6, y: 6, w: 1, h: 1, pinned: false },
  ];
  const now = 100 * 3_600_000;
  it("the newest block if it is fresh, else the hottest, else the newest, else the densest cluster", () => {
    expect(spawnTile({ placed, lastAt: { c: now - 3_600_000, a: now - 50 * 3_600_000 }, heat: {}, now })).toEqual({ x: 6, y: 6 });
    expect(spawnTile({ placed, lastAt: { c: now - 20 * 3_600_000 }, heat: { b: 2 }, now })).toEqual({ x: -1, y: 1 });
    expect(spawnTile({ placed, lastAt: { c: now - 20 * 3_600_000 }, heat: {}, now })).toEqual({ x: 6, y: 6 });
    expect(spawnTile({ placed, lastAt: {}, heat: {}, now })).toEqual({ x: 0, y: 0 }); // a has a neighbour, c has none
    expect(spawnTile({ placed: [], lastAt: {}, heat: {}, now })).toEqual({ x: 0, y: 0 });
  });
});

describe("decay", () => {
  const day = 86_400_000;
  it("counts down from the last touch, never for pinned blocks or when decay is off", () => {
    const now = 10 * day;
    expect(lifeLeft({ decayDays: 7, lastTouchedAt: now - 2 * day, fallback: 0, now })).toEqual({ left: 5 * day, window: 7 * day });
    expect(lifeLeft({ decayDays: 7, lastTouchedAt: null, fallback: now - 8 * day, now }).left).toBe(-day);
    expect(lifeLeft({ decayDays: 7, pinned: true, lastTouchedAt: null, fallback: 0, now }).left).toBeNull();
    expect(lifeLeft({ decayDays: false, lastTouchedAt: null, fallback: 0, now }).left).toBeNull();
    expect(lifeLeft({ decayDays: 0, lastTouchedAt: null, fallback: 0, now }).left).toBeNull();
  });
});
