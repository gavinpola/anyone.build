import { describe, expect, it } from "vitest";
import { clampPan, clampZoom, fitZoom, packBlocks, parsePoint, parseRegion, pointText, regionText, toWorld, widthFor, worldSize, zoomAround } from "../../src/core/room/canvas";

const world = { w: 2400, h: 1600 };

describe("the bounded canvas", () => {
  it("has a fixed world, clamped to sane sizes", () => {
    expect(worldSize({})).toEqual({ w: 2400, h: 1600 });
    expect(worldSize({ size: { w: 100, h: 99999 } })).toEqual({ w: 800, h: 12000 });
  });
  it("fits the world to the viewport (never magnifying) and clamps zoom between fit and the max", () => {
    const fit = fitZoom({ w: 1200, h: 800 }, world);
    expect(fit).toBeCloseTo(0.5);
    expect(fitZoom({ w: 5000, h: 5000 }, world)).toBe(1);
    expect(clampZoom(0.1, fit)).toBe(fit);
    expect(clampZoom(9, fit)).toBe(1.6);
  });
  it("keeps the world on screen: centred when smaller, never dragged fully off when larger", () => {
    expect(clampPan({ x: 999, y: 999 }, 0.25, { w: 1200, h: 800 }, world)).toEqual({ x: 300, y: 200 });
    const p = clampPan({ x: -99999, y: 50 }, 1, { w: 1200, h: 800 }, world);
    expect(p.x).toBe(1200 - 2400);
    expect(p.y).toBe(0);
  });
  it("zooming around a point keeps the world under the pointer still", () => {
    const from = { pan: { x: 0, y: 0 }, zoom: 1 };
    const pan = zoomAround({ x: 600, y: 400 }, from, 2);
    const before = toWorld({ x: 600, y: 400 }, { left: 0, top: 0 }, from.pan, from.zoom);
    const after = toWorld({ x: 600, y: 400 }, { left: 0, top: 0 }, pan, 2);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });
});

describe("packing blocks into the world", () => {
  const item = (id: string, w: number, h: number, order = 0, place?: { x: number; y: number; w: number }) => ({ id, w, h, order, place });
  const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  it("never overlaps, keeps explicit places, fills rows left to right, and reports the bottom", () => {
    const items = [item("a", 1200, 400, 0), item("b", 1100, 300, 1), item("c", 800, 200, 2), item("d", 600, 500, 3, { x: 1500, y: 900, w: 600 }), item("e", 2300, 240, 4)];
    const { placed, bottom } = packBlocks(items, world, 20, 20);
    expect(placed).toHaveLength(5);
    for (const p of placed) for (const q of placed) if (p.id !== q.id) expect(overlaps(p, q), `${p.id} overlaps ${q.id}`).toBe(false);
    const by = Object.fromEntries(placed.map((p) => [p.id, p]));
    expect(by.d).toMatchObject({ x: 1500, y: 900, w: 600, pinned: true });
    expect(by.a).toMatchObject({ x: 20, y: 20 });
    expect(by.b!.y).toBe(20); // fits beside a
    expect(by.b!.x).toBeGreaterThan(1200);
    expect(by.c!.y).toBeGreaterThan(300); // next row
    expect(bottom).toBeGreaterThanOrEqual(Math.max(...placed.map((p) => p.y + p.h)));
  });
  it("is deterministic and clamps a place to the world", () => {
    const items = [item("x", 500, 100, 0), item("y", 500, 100, 1, { x: 99999, y: -5, w: 99999 })];
    const a = packBlocks(items, world, 20, 20);
    const b = packBlocks(items, world, 20, 20);
    expect(a).toEqual(b);
    const y = a.placed.find((p) => p.id === "y")!;
    expect(y.w).toBe(2400 - 40);
    expect(y.x).toBe(20);
    expect(y.y).toBe(20);
  });
  it("widths come from span or size, relative to the world", () => {
    expect(widthFor({ size: "full" }, world, 20, 20)).toBe(1120);
    expect(widthFor({ size: "md" }, world, 20, 20)).toBe(520);
    expect(widthFor({ size: "sm" }, world, 20, 20)).toBe(360);
    expect(widthFor({ size: "sm", span: 3 }, world, 20, 20)).toBe(575);
    expect(widthFor({ size: "full" }, { w: 800, h: 600 }, 20, 20)).toBe(760);
  });
});

describe("regions and points as words", () => {
  it("round-trip through text the judge reads", () => {
    const t = regionText({ x: 120.4, y: 80, w: 640, h: 400 }, ["hello-note", "electric-message"]);
    expect(t).toBe("region 120,80,640,400 · contains: hello-note, electric-message");
    expect(parseRegion(t)).toEqual({ x: 120, y: 80, w: 640, h: 400 });
    expect(parseRegion("nothing")).toBeNull();
    expect(parsePoint(pointText({ x: 10.6, y: 20 }))).toEqual({ x: 11, y: 20 });
    expect(regionText({ x: 0, y: 0, w: 1, h: 1 }, Array.from({ length: 40 }, (_, i) => `block-${i}`)).length).toBeLessThanOrEqual(120);
  });
});

import { lifeLeft } from "../../src/core/room/canvas";
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
