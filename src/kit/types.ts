/** Metadata every block exports as `block`. */
export type BlockMeta = {
  /** Stable id, kebab-case, unique within the room. Never change it once live. */
  id: string;
  /** Shown on the placard under the frame. */
  title: string;
  /** One line, shown to the judge and in the manifest. */
  description: string;
  /** Lower comes first. Ties broken by id. */
  order: number;
  /** Width on the 12-column wall. */
  size: "sm" | "md" | "lg" | "full";
  /**
   * How the block sits on the wall. A preset ("card" = the classic frame, "soft" = big rounded corners,
   * "round" = a pill, "bare" = no card at all, the content sits straight on the paper) or your own shape.
   * Unset = picked from the wall's palette (src/rooms/<room>/canvas.ts), so the wall varies on its own.
   */
  shape?: ShapePreset | CustomShape;
  /** A slight hand-hung tilt in degrees, -3..3. Unset = picked from the id within the canvas's tilt range. */
  tilt?: number;
  /** Width in wall columns (1..12), overriding `size`. */
  span?: number;
  /**
   * Free placement on the canvas: x and w in percent of the wall's width, y in pixels from its top. A placed
   * block leaves the flow and sits exactly there (on phones it flows again). Blocks may overlap; later `order`
   * is on top.
   */
  place?: { x: number; y: number; w: number };
};

export type ShapePreset = "card" | "soft" | "round" | "bare";

/** Any shape: CSS values, no URLs (the validator refuses them). */
export type CustomShape = {
  /** e.g. "24px", "40px 8px", "50%" */
  radius?: string;
  /** e.g. "polygon(0 0, 100% 4%, 96% 100%, 2% 92%)" or "ellipse(50% 45% at 50% 50%)" */
  clip?: string;
  /** e.g. "#0e0c09", "linear-gradient(135deg, #1b1712, #050403)" */
  background?: string;
  /** text colour on that background */
  color?: string;
  /** e.g. "2px dashed #ffd84d", or "none" */
  border?: string;
  /** e.g. "0 12px 40px rgba(0,0,0,.25)", or "none" */
  shadow?: string;
  /** inner padding, e.g. "28px" */
  padding?: string;
};

/**
 * The wall itself, exported as `canvas` from src/rooms/<room>/canvas.ts. Every field is changeable by asking:
 * the wall's boundaries are part of the wall.
 */
export type CanvasMeta = {
  /** CSS background for the wall behind the blocks (colours, gradients; no URLs). */
  background?: string;
  /** space between blocks, px */
  gap?: number;
  /** the wall's outer corner radius, px */
  radius?: number;
  /** inner padding around the blocks, px */
  padding?: number;
  /** columns in the grid (6..16); block spans and sizes are relative to this */
  columns?: number;
  /** shapes handed to blocks that don't choose one, cycled by each block's id */
  shapes?: ShapePreset[];
  /** biggest tilt handed to blocks that don't choose one, degrees (0 = straight) */
  tilt?: number;
  /** vertical stagger handed out, px (0 = none) */
  stagger?: number;
  /** minimum height of the wall when blocks are placed freely, px */
  height?: number;
};

export type BlockModule = {
  default: React.ComponentType;
  block: BlockMeta;
};

/** Metadata every page exports as `page`. Pages are routes: /r/<room>/<slug>. */
export type PageMeta = {
  /** URL slug, kebab-case, unique within the room. Never change it once live. */
  slug: string;
  /** Shown in the room's Pages strip and on the placard. */
  title: string;
  /** One line, shown to the judge and in the manifest. */
  description: string;
};

export type PageModule = {
  default: React.ComponentType;
  page: PageMeta;
};
