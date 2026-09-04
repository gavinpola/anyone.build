import type { CSSProperties } from "react";
import type { BlockMeta, CanvasMeta, CustomShape, ShapePreset } from "@/kit";

/**
 * How a block hangs on the wall: its body (shape, tint, blend), tilt, drift, and width, from its own meta
 * first and the wall's canvas (src/rooms/<room>/canvas.ts) otherwise. Pure, so the wall's variety is the
 * same for everyone and testable without a browser.
 */
export const DEFAULT_SHAPES: ShapePreset[] = ["blob", "blob", "soft", "blob", "blob", "round", "blob", "bare"];
/** Paper: warm tints close to the site's own paper, one accent at most. Bodies are opaque sheets. */
export const DEFAULT_PALETTE = ["#fbf6ea", "#f3e9d2", "#f6e7de", "#e9eddf", "#f9e8c6", "#eddcc4", "#fbf6ea", "#f2e3cf"];
const TILT_STEPS = [-1, 0, 0.6, -0.45, 1, 0, -0.7];
const STAGGER_STEPS = [0, 0.4, 1, 0, 0.7];

/** A stable little number from an id. */
export function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (h >>> 0) % 100000;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function columnsOf(c: CanvasMeta): number {
  return clamp(Math.round(c.columns ?? 12), 6, 16);
}

function sizeToSpan(size: BlockMeta["size"] | undefined, columns: number): number {
  const f = { sm: 1 / 3, md: 1 / 2, lg: 2 / 3, full: 1 }[size ?? "md"] ?? 1 / 2;
  return clamp(Math.round(columns * f), 1, columns);
}

/** An eight-value organic radius from a seed; `phase` gives a second outline to morph towards. */
export function blobRadius(seed: number, phase = 0): string {
  const v = (k: number, lo: number, hi: number) => {
    const x = Math.abs(Math.sin(seed * 0.37 + k * 1.93 + phase * 2.1)) % 1;
    return Math.round(lo + x * (hi - lo));
  };
  // horizontal radii are capped in px so a wide, short block keeps a body instead of collapsing into a lens
  const hz = (k: number) => `min(${v(k, 35, 70)}%, ${v(k + 10, 90, 220)}px)`;
  return `${hz(1)} ${hz(2)} ${hz(3)} ${hz(4)} / ${v(5, 35, 70)}% ${v(6, 30, 65)}% ${v(7, 30, 70)}% ${v(8, 35, 70)}%`;
}

/**
 * A hand-cut outline: a polygon around the box with a little jitter per corner, in percent so it fits any
 * size. `jitter` is how rough the cut is (0.02 = a neat sheet, 0.12 = a torn blob); `phase` gives a
 * second cut for the body to breathe towards.
 */
export function cutPath(seed: number, jitter: number, points = 18, phase = 0): string {
  const pts: string[] = [];
  for (let i = 0; i < points; i++) {
    const t = (i / points) * Math.PI * 2;
    const j = (k: number) => (Math.abs(Math.sin(seed * 0.29 + i * 1.7 + k * 3.1 + phase * 2.3)) % 1) * 2 - 1;
    // a superellipse-ish outline so sheets stay sheet-like, pushed in and out by the jitter
    const cx = Math.cos(t);
    const cy = Math.sin(t);
    const r = 1 + j(1) * jitter;
    const x = 50 + 50 * Math.sign(cx) * Math.pow(Math.abs(cx), 0.6) * r;
    const y = 50 + 50 * Math.sign(cy) * Math.pow(Math.abs(cy), 0.6) * r;
    pts.push(`${Math.max(0, Math.min(100, x)).toFixed(1)}% ${Math.max(0, Math.min(100, y)).toFixed(1)}%`);
  }
  return `polygon(${pts.join(", ")})`;
}

const CUT: Record<ShapePreset, number> = { card: 0.018, square: 0.012, soft: 0.035, round: 0.03, bare: 0, blob: 0.09 };

export type Body = {
  /** the block's shape preset, or "custom" */
  kind: ShapePreset | "custom";
  /** border-radius for the body (blobs: eight values) */
  radius: string;
  /** a second outline for the morph, when the body breathes */
  radius2: string;
  /** the hand-cut outline (clip-path), and a second one to breathe towards */
  clip: string;
  clip2: string;
  tint: string;
  blend: NonNullable<CustomShape["blend"]>;
  /** painted on the liquid layer (true) or by the block itself (false) */
  merge: boolean;
};

export type Hung = {
  shape: ShapePreset | CustomShape;
  body: Body;
  tilt: number;
  stagger: number;
  span: number;
  columns: number;
  place: BlockMeta["place"] | undefined;
};

const PRESET_RADIUS: Record<Exclude<ShapePreset, "blob">, string> = { card: "12px", square: "0px", soft: "26px", round: "999px", bare: "12px" };

export function hang(meta: Pick<BlockMeta, "id" | "size"> & Partial<Pick<BlockMeta, "shape" | "tilt" | "span" | "place">>, c: CanvasMeta): Hung {
  const h = hashId(meta.id);
  const palette = c.shapes?.length ? c.shapes : DEFAULT_SHAPES;
  const shape = meta.shape ?? palette[h % palette.length]!;
  const maxTilt = clamp(c.tilt ?? 1.2, 0, 3);
  const tilt = meta.tilt != null ? clamp(meta.tilt, -3, 3) : TILT_STEPS[(h >> 3) % TILT_STEPS.length]! * maxTilt;
  const stagger = STAGGER_STEPS[(h >> 6) % STAGGER_STEPS.length]! * clamp(c.stagger ?? 14, 0, 60);
  const columns = columnsOf(c);
  const span = meta.span != null ? clamp(Math.round(meta.span), 1, columns) : sizeToSpan(meta.size, columns);
  const place = meta.place && Number.isFinite(meta.place.x) && Number.isFinite(meta.place.y) && Number.isFinite(meta.place.w)
    ? { x: clamp(meta.place.x, 0, 95), y: clamp(meta.place.y, 0, 20000), w: clamp(meta.place.w, 5, 100) }
    : undefined;
  const tints = c.palette?.length ? c.palette : DEFAULT_PALETTE;
  const custom = typeof shape === "string" ? null : shape;
  const kind: Body["kind"] = typeof shape === "string" ? shape : "custom";
  const paintsItself = Boolean(custom?.background);
  const body: Body = {
    kind,
    radius: custom?.blob ?? custom?.radius ?? (kind === "blob" ? blobRadius(h) : PRESET_RADIUS[kind as Exclude<ShapePreset, "blob">] ?? "12px"),
    radius2: custom?.blob ?? custom?.radius ?? (kind === "blob" ? blobRadius(h, 1) : PRESET_RADIUS[kind as Exclude<ShapePreset, "blob">] ?? "12px"),
    clip: custom?.clip ?? cutPath(h, CUT[kind === "custom" ? "soft" : kind] ?? 0.04, kind === "round" ? 28 : 18),
    clip2: custom?.clip ?? cutPath(h, CUT[kind === "custom" ? "soft" : kind] ?? 0.04, kind === "round" ? 28 : 18, 1),
    tint: custom?.tint ?? tints[(h >> 2) % tints.length]!,
    blend: custom?.blend ?? "normal",
    merge: custom?.merge ?? (!paintsItself && kind !== "bare"),
  };
  const t = Math.round(tilt * 100) / 100;
  return { shape, body, tilt: t === 0 ? 0 : t, stagger: Math.round(stagger) || 0, span, columns, place };
}

const PRESET_CLASS: Record<ShapePreset, string> = {
  card: "frame",
  square: "frame frame-square",
  soft: "frame frame-soft",
  round: "frame frame-round",
  bare: "frame frame-bare",
  blob: "frame frame-blob",
};

/** The class and inline style for a shape. Custom shapes are plain CSS values; the validator refuses URLs. */
export function shapeStyle(shape: ShapePreset | CustomShape, body?: Body): { className: string; style: CSSProperties } {
  if (typeof shape === "string") {
    const style: CSSProperties = shape === "blob" && body ? { borderRadius: body.radius } : {};
    return { className: PRESET_CLASS[shape] ?? "frame", style };
  }
  const style: CSSProperties = {};
  if (shape.blob) style.borderRadius = shape.blob;
  else if (shape.radius) style.borderRadius = shape.radius;
  if (shape.clip) style.clipPath = shape.clip;
  if (shape.background) style.background = shape.background;
  if (shape.color) style.color = shape.color;
  if (shape.border) style.border = shape.border;
  if (shape.shadow) style.boxShadow = shape.shadow;
  if (shape.padding) style.padding = shape.padding;
  return { className: "frame frame-custom", style };
}

/** CSS variables for the wall itself. */
export function wallStyle(c: CanvasMeta, anyPlaced: boolean): CSSProperties {
  const s: Record<string, string> = {
    "--wall-gap": `${clamp(c.gap ?? 24, 0, 80)}px`,
    "--wall-radius": `${clamp(c.radius ?? 28, 0, 120)}px`,
    "--wall-pad": `${clamp(c.padding ?? 6, 0, 80)}px`,
    "--wall-cols": String(columnsOf(c)),
    "--wall-overlap": `${clamp(c.overlap ?? 0, 0, 80)}px`,
  };
  if (c.background) s["--wall-bg"] = c.background;
  s["--wall-liquid"] = String(clamp(c.liquid ?? 0.5, 0, 1));
  if (anyPlaced) s["--wall-min-h"] = `${clamp(c.height ?? 900, 200, 20000)}px`;
  return s as CSSProperties;
}
