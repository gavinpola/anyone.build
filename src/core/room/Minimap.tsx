import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Placed, Pan, World } from "./canvas";
import { readPref, writePref } from "@/core/lib/prefs";

/**
 * A map of the world, bottom-right: every block as a small rectangle, the viewport as a frame.
 * Click to go there; click a block to jump to it. It folds to a chip (remembered per browser) and
 * steps aside while you point.
 */
export function Minimap({
  world,
  placed,
  pan,
  zoom,
  viewport,
  onGo,
  onGoBlock,
  highlight,
  compact = false,
}: {
  world: World;
  placed: Placed[];
  pan: Pan;
  zoom: number;
  viewport: { w: number; h: number };
  onGo: (worldPoint: { x: number; y: number }) => void;
  onGoBlock?: (id: string) => void;
  highlight?: string | null;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(() => {
    const v = readPref("map");
    return v ? v === "open" : !compact;
  });
  const toggle = () => {
    const next = !open;
    setOpen(next);
    writePref("map", next ? "open" : "closed");
  };
  const W = 168;
  const k = W / world.w;
  const H = Math.round(world.h * k);
  const vx = -pan.x / zoom;
  const vy = -pan.y / zoom;
  const vw = viewport.w / zoom;
  const vh = viewport.h / zoom;
  return (
    <div className="minimap" data-minimap data-minimap-open={open ? "1" : "0"} aria-label="Map of the wall">
      <button type="button" className="minimap-toggle" onClick={toggle} aria-expanded={open} aria-label={open ? "Hide the map" : "Show the map"}>
        <span className="placard smallcaps">map</span>
        {open ? <ChevronDown size={12} aria-hidden /> : <ChevronUp size={12} aria-hidden />}
      </button>
      {open ? (
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
            <rect
              key={p.id}
              data-map-block={p.id}
              x={p.x}
              y={p.y}
              width={p.w}
              height={p.h}
              rx={0}
              className={"minimap-block" + (highlight === p.id ? " is-hot" : "")}
              onPointerDown={(e) => {
                if (!onGoBlock) return;
                e.stopPropagation();
                onGoBlock(p.id);
              }}
            />
          ))}
          <rect x={vx} y={vy} width={vw} height={vh} className="minimap-view" />
        </svg>
      ) : null}
    </div>
  );
}
