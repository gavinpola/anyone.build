/** The ground warms where people are working: cursors and fresh asks each add a soft glow, in world px, over the known world. */
export function Heat({ spots, area }: { spots: Array<{ x: number; y: number; r: number; a: number }>; area: { x: number; y: number; w: number; h: number } }) {
  if (!spots.length) return null;
  const bg = spots
    .slice(0, 40)
    .map((s) => `radial-gradient(${Math.round(s.r)}px ${Math.round(s.r)}px at ${Math.round(s.x - area.x)}px ${Math.round(s.y - area.y)}px, color-mix(in oklab, var(--accent) ${Math.round(s.a * 100)}%, transparent), transparent 70%)`)
    .join(", ");
  return <div className="heat" aria-hidden style={{ left: area.x, top: area.y, width: area.w, height: area.h, backgroundImage: bg }} />;
}
