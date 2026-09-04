/** The ground warms where people are working: cursors and fresh asks each add a soft glow, in world units. */
export function Heat({ spots, world }: { spots: Array<{ x: number; y: number; r: number; a: number }>; world: { w: number; h: number } }) {
  if (!spots.length) return null;
  const bg = spots
    .slice(0, 40)
    .map((s) => `radial-gradient(${Math.round(s.r)}px ${Math.round(s.r)}px at ${Math.round(s.x)}px ${Math.round(s.y)}px, color-mix(in oklab, var(--accent) ${Math.round(s.a * 100)}%, transparent), transparent 70%)`)
    .join(", ");
  return <div className="heat" aria-hidden style={{ width: world.w, height: world.h, backgroundImage: bg }} />;
}
