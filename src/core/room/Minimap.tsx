import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { parsePoint, parseRegion, type Placed, type Pan, type Rect, type World } from "./canvas";
import { readPref, writePref } from "@/core/lib/prefs";
import { usePicker } from "@/core/picker/pickerStore";

/**
 * A map of the world, bottom-right: every block as a small rectangle, the viewport as a frame.
 * Click to go there; click a block to jump to it. It folds to a chip (remembered per browser) and
 * steps aside while you point. Orange on the map means the same as orange on the wall: what you're
 * pointing at (a block, a dragged-out space, a point); the viewport frame is ink so the two never mix.
 */
export function Minimap({
  world,
  placed,
  pan,
  zoom,
  viewport,
  onGo,
  onGoBlock,
  mark,
  compact = false,
}: {
  world: World;
  placed: Placed[];
  pan: Pan;
  zoom: number;
  viewport: { w: number; h: number };
  onGo: (worldPoint: { x: number; y: number }) => void;
  onGoBlock?: (id: string) => void;
  /** a space being dragged out right now, in world px */
  mark?: Rect | null;
  compact?: boolean;
}) {
  // what's highlighted on the wall shows here too
  const { hover, selected } = usePicker();
  const target = hover ?? selected;
  const hot = target?.blockId ?? null;
  const region = mark ?? (target?.tag === "region" ? parseRegion(target.text) : null);
  const point = !region && target ? parsePoint(target.text) : null;
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
              className={"minimap-block" + (hot === p.id ? " is-hot" : "")}
              onPointerDown={(e) => {
                if (!onGoBlock) return;
                e.stopPropagation();
                onGoBlock(p.id);
              }}
            />
          ))}
          {region ? <rect data-map-mark x={region.x} y={region.y} width={region.w} height={region.h} className="minimap-mark" /> : null}
          {point ? <circle data-map-mark cx={point.x} cy={point.y} r={28} className="minimap-dot" /> : null}
          <rect x={vx} y={vy} width={vw} height={vh} className="minimap-view" />
        </svg>
      ) : null}
    </div>
  );
}
