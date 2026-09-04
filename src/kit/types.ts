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
   * How the block sits on the wall. A preset ("card" = the classic frame, "square" = a plain box with no corners, "soft" = big rounded corners,
   * "round" = a pill, "bare" = no card at all, the content sits straight on the paper) or your own shape.
   * Unset = picked from the wall's palette (src/rooms/<room>/canvas.ts), so the wall varies on its own.
   */
  shape?: ShapePreset | CustomShape;
  /** A slight hand-hung tilt in degrees, -3..3. Unset = picked from the id within the canvas's tilt range. */
  tilt?: number;
  /** Width in wall columns (1..12), overriding `size`. */
  span?: number;
  /** never fades (the wall header, the rules): decay skips it */
  pinned?: boolean;
  /** Taken off the wall. The file stays as history and "bring it back" is one flip; the wall, the manifest, and the playtester skip it. */
  removed?: boolean;
  /**
   * Where the block sits on the canvas, in world pixels (the canvas has a fixed size, see CanvasMeta.size):
   * x and y from the top-left, w the width. A placed block sits exactly there; blocks without a place are
   * packed into the free space in `order`. On phones everything stacks.
   */
  place?: { x: number; y: number; w: number };
};

/** "blob" = an organic eight-radius body that morphs slowly and merges with its neighbours on the liquid layer. */
export type ShapePreset = "card" | "square" | "soft" | "round" | "bare" | "blob";

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
  /** an organic body: eight-value border-radius, e.g. "60% 40% 30% 70% / 60% 30% 70% 40%" */
  blob?: string;
  /** the body's colour on the liquid layer (any CSS colour; translucent blends best) */
  tint?: string;
  /** how the body blends with what it overlaps */
  blend?: "normal" | "multiply" | "screen" | "overlay" | "soft-light";
  /** take part in the liquid layer (fuse with neighbours). Default true unless the shape paints its own background. */
  merge?: boolean;
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
  /** "instrument": crisp cards with a mono header (who, what, time left) on a dotted ground. "paper": cut-paper sheets that fuse. */
  skin?: "instrument" | "paper";
  /** the ground: dots, lines, or plain */
  grid?: "dots" | "lines" | "none";
  /** decay: days a block lives untouched before it fades; 0 or false = nothing fades */
  decay?: number | false;
  /** the ground warms where people are working */
  heat?: boolean;
  /** a map of the world in the corner */
  minimap?: boolean;
  /** phones: the same canvas with pinch and pan (default), or a plain stack */
  mobile?: "canvas" | "stack";
  /** the fixed size of the canvas in px at zoom 1 (people zoom and pan inside it); default 2400 × 1600 */
  size?: { w: number; h: number };
  /** minimum height of the wall when blocks are placed freely, px (legacy; `size` wins) */
  height?: number;
  /** "organic" packs blocks densely with overlap so bodies touch and merge; "grid" is neat rows */
  flow?: "grid" | "organic";
  /** the liquid layer: bodies near each other fuse like drops of paint */
  goo?: boolean;
  /** how far bodies reach into each other, px (organic flow) */
  overlap?: number;
  /** tints handed to bodies that don't choose one, cycled by id */
  palette?: string[];
  /** bodies breathe: their outlines drift slowly */
  morph?: boolean;
  /** how strong the liquid layer is, 0..1 (bodies are solid; this is the layer's opacity) */
  liquid?: number;
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
