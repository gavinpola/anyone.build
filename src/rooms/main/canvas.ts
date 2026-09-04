import type { CanvasMeta } from "@/kit";

/**
 * The wall itself. Its background, its spacing, the shapes it hands to blocks that don't pick their own,
 * how much they tilt: all of it is changeable by asking, like anything on the wall. Only the site's chrome
 * (header, feed, leaderboard) is not.
 */
export const canvas: CanvasMeta = {
  background:
    "radial-gradient(60% 40% at 15% 0%, rgba(255, 216, 77, 0.10), transparent 70%), radial-gradient(50% 35% at 90% 30%, rgba(20, 16, 10, 0.05), transparent 70%)",
  gap: 24,
  radius: 28,
  padding: 6,
  columns: 12,
  shapes: ["card", "soft", "card", "round", "soft", "card", "bare"],
  tilt: 1.2,
  stagger: 14,
};
