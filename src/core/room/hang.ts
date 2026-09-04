import type { CSSProperties } from "react";
import type { BlockMeta, CanvasMeta, CustomShape, ShapePreset } from "@/kit";

/**
 * How a block hangs on the wall: its shape, tilt, stagger, and width, from its own meta first and the
 * wall's canvas (src/rooms/<room>/canvas.ts) otherwise. Pure, so the wall's variety is the same for
 * everyone and testable without a browser.
 */
export const DEFAULT_SHAPES: ShapePreset[] = ["card", "soft", "card", "round", "soft", "card", "bare"];
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

export type Hung = {
  shape: ShapePreset | CustomShape;
  tilt: number;
  stagger: number;
  span: number;
  columns: number;
  place: BlockMeta["place"] | undefined;
};

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
  const t = Math.round(tilt * 100) / 100;
  return { shape, tilt: t === 0 ? 0 : t, stagger: Math.round(stagger) || 0, span, columns, place };
}

const PRESET_CLASS: Record<ShapePreset, string> = {
  card: "frame",
  soft: "frame frame-soft",
  round: "frame frame-round",
  bare: "frame frame-bare",
};

/** The class and inline style for a shape. Custom shapes are plain CSS values; the validator refuses URLs. */
export function shapeStyle(shape: ShapePreset | CustomShape): { className: string; style: CSSProperties } {
  if (typeof shape === "string") return { className: PRESET_CLASS[shape] ?? "frame", style: {} };
  const style: CSSProperties = {};
  if (shape.radius) style.borderRadius = shape.radius;
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
  };
  if (c.background) s["--wall-bg"] = c.background;
  if (anyPlaced) s["--wall-min-h"] = `${clamp(c.height ?? 900, 200, 20000)}px`;
  return s as CSSProperties;
}
