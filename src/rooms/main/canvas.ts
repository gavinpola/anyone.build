import type { CanvasMeta } from "@/kit";

/**
 * The wall itself. Its flow, its liquid (bodies that fuse where they touch), its palette, its spacing:
 * all of it is changeable by asking, like anything on the wall. Only the site's chrome (header, feed,
 * leaderboard) is not.
 */
export const canvas: CanvasMeta = {
  // The world is exactly this big, always; the map is this rectangle. To make the wall taller, ask for it (this file).
  size: { w: 2400, h: 3000 },
  skin: "instrument",
  grid: "dots",
  decay: 7,
  heat: true,
  minimap: true,
  flow: "organic",
  goo: false, // the paper skin turns this on
  morph: true,
  overlap: 26,
  gap: 14,
  radius: 40,
  padding: 18,
  columns: 12,
  background: "radial-gradient(80% 50% at 20% 0%, rgba(255, 216, 77, 0.07), transparent 70%), linear-gradient(180deg, rgba(60, 40, 10, 0.012), rgba(60, 40, 10, 0.03))",
  shapes: ["blob", "blob", "soft", "blob", "blob", "round", "blob", "bare"],
  // sheets of paper, warm and close to the wall's own paper; one accent at most
  palette: ["#fbf6ea", "#f3e9d2", "#f6e7de", "#e9eddf", "#f9e8c6", "#eddcc4", "#fbf6ea", "#ffe9a3"],
  liquid: 1,
  tilt: 1.6,
  stagger: 26,
};
