import type { Placed, Pan, World } from "./canvas";

/** A map of the world, bottom-right: every block as a small rectangle, the viewport as a frame. Click to go there. */
export function Minimap({
  world,
  placed,
  pan,
  zoom,
  viewport,
  onGo,
  highlight,
}: {
  world: World;
  placed: Placed[];
  pan: Pan;
  zoom: number;
  viewport: { w: number; h: number };
  onGo: (worldPoint: { x: number; y: number }) => void;
  highlight?: string | null;
}) {
  const W = 168;
  const k = W / world.w;
  const H = Math.round(world.h * k);
  const vx = -pan.x / zoom;
  const vy = -pan.y / zoom;
  const vw = viewport.w / zoom;
  const vh = viewport.h / zoom;
  return (
    <div className="minimap" data-minimap aria-label="Map of the wall">
      <span className="placard smallcaps">map</span>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${world.w} ${world.h}`}
        className="mt-1 block cursor-pointer"
        onPointerDown={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          onGo({ x: ((e.clientX - r.left) / r.width) * world.w, y: ((e.clientY - r.top) / r.height) * world.h });
        }}
      >
        <rect x={0} y={0} width={world.w} height={world.h} className="minimap-ground" />
        {placed.map((p) => (
          <rect key={p.id} x={p.x} y={p.y} width={p.w} height={p.h} rx={16} className={"minimap-block" + (highlight === p.id ? " is-hot" : "")} />
        ))}
        <rect x={vx} y={vy} width={vw} height={vh} className="minimap-view" />
      </svg>
    </div>
  );
}
