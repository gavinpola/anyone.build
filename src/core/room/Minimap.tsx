import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { TILE_H, TILE_W, parseTile, parseTiles, tileGround, type Cam, type Placed, type Tile, type TileRect } from "./canvas";
import { readPref, writePref } from "@/core/lib/prefs";
import { usePicker } from "@/core/picker/pickerStore";
import { track } from "@/core/lib/analytics";

type Filter = "hot" | "new" | "mine";

/**
 * The teleport pad, bottom-right: the known world as tiles, every block a small rectangle, your screen a
 * green frame, other people as dots. Tap a tile to go there; tap a block to jump to it. Three filters
 * light up what is hot (people and fresh asks), new (the last day), or yours. It folds to a chip
 * (remembered per browser) and steps aside while you point. It is navigation, not a scale control:
 * there is no zoom anywhere on it.
 */
export function Minimap({
  placed,
  bounds,
  cam,
  viewport,
  onGo,
  onGoBlock,
  mark,
  me,
  hot,
  fresh,
  mine,
  peers,
  compact = false,
  faded,
  onRevive,
}: {
  placed: Placed[];
  bounds: TileRect;
  cam: Cam;
  viewport: { w: number; h: number };
  onGo: (tile: Tile) => void;
  onGoBlock?: (id: string) => void;
  /** tiles being dragged out right now */
  mark?: TileRect | null;
  /** your own pointer, as a tile */
  me?: Tile | null;
  hot: Set<string>;
  fresh: Set<string>;
  mine: Set<string>;
  /** other people's pointers, in tiles */
  peers: Array<{ x: number; y: number }>;
  compact?: boolean;
  /** objects that faded off the wall; their names are buttons that revive them */
  faded?: { id: string; title: string }[];
  onRevive?: (id: string) => void;
}) {
  // what's highlighted on the wall shows here too
  const { hover, selected } = usePicker();
  const target = hover ?? selected;
  const hotOne = target?.blockId ?? null;
  const region = mark ?? (target?.tag === "region" ? parseTiles(target.text) : null);
  const point = !region && target ? parseTile(target.text) : null;
  const [open, setOpen] = useState(() => {
    const v = readPref("map");
    return v ? v === "open" : !compact;
  });
  const [filter, setFilter] = useState<Filter | null>(() => {
    const v = readPref("map-filter");
    return v === "hot" || v === "new" || v === "mine" ? v : null;
  });
  const toggle = () => {
    const next = !open;
    setOpen(next);
    writePref("map", next ? "open" : "closed");
    track("map_toggle", { open: next });
  };
  const pick = (f: Filter) => {
    const next = filter === f ? null : f;
    setFilter(next);
    writePref("map-filter", next ?? "");
    track("map_filter", { filter: next });
  };
  const lit = filter === "hot" ? hot : filter === "new" ? fresh : filter === "mine" ? mine : null;
  const g = tileGround(bounds);
  const W = 196;
  const k = W / g.w;
  const H = Math.max(40, Math.min(150, Math.round(g.h * k)));
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  for (let x = bounds.x + 1; x < bounds.x + bounds.w; x++) lines.push({ x1: x * TILE_W, y1: g.y, x2: x * TILE_W, y2: g.y + g.h });
  for (let y = bounds.y + 1; y < bounds.y + bounds.h; y++) lines.push({ x1: g.x, y1: y * TILE_H, x2: g.x + g.w, y2: y * TILE_H });
  return (
    <div className="minimap" data-minimap data-minimap-open={open ? "1" : "0"} aria-label="Teleport map">
      <button type="button" className="minimap-toggle" onClick={toggle} aria-expanded={open} aria-label={open ? "Hide the map" : "Show the map"}>
        <span className="placard smallcaps">{compact ? "map" : `teleport · ${bounds.w}×${bounds.h} tiles`}</span>
        {open ? <ChevronDown size={12} aria-hidden /> : <ChevronUp size={12} aria-hidden />}
      </button>
      {open ? (
        <>
          <svg
            width={W}
            height={H}
            viewBox={`${g.x} ${g.y} ${g.w} ${g.h}`}
            preserveAspectRatio="xMidYMid meet"
            className="mt-1 block cursor-pointer"
            onPointerDown={(e) => {
              const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
              // the picture is letterboxed inside the svg: map the press through the same fit
              const s = Math.min(r.width / g.w, r.height / g.h);
              const ox = (r.width - g.w * s) / 2;
              const oy = (r.height - g.h * s) / 2;
              const wx = g.x + (e.clientX - r.left - ox) / s;
              const wy = g.y + (e.clientY - r.top - oy) / s;
              onGo({ x: Math.floor(wx / TILE_W), y: Math.floor(wy / TILE_H) });
              track("map_teleport");
            }}
          >
            <rect x={g.x} y={g.y} width={g.w} height={g.h} className="minimap-ground" />
            {lines.map((l, i) => (
              <line key={i} {...l} className="minimap-grid" />
            ))}
            {placed.map((p) => {
              const b = tileGround(p);
              const dim = lit ? !lit.has(p.id) : false;
              return (
                <rect
                  key={p.id}
                  data-map-block={p.id}
                  x={b.x + 12}
                  y={b.y + 12}
                  width={b.w - 24}
                  height={b.h - 24}
                  className={"minimap-block" + (hotOne === p.id ? " is-hot" : "") + (lit && !dim ? " is-lit" : "") + (dim ? " is-dim" : "")}
                  onPointerDown={(e) => {
                    if (!onGoBlock) return;
                    e.stopPropagation();
                    onGoBlock(p.id);
                    track("map_jump", { block: p.id });
                  }}
                />
              );
            })}
            {peers.map((p, i) => (
              <circle key={i} data-map-peer cx={p.x * TILE_W} cy={p.y * TILE_H} r={26} className="minimap-peer" />
            ))}
            {region ? <rect data-map-mark {...tileGround(region)} x={tileGround(region).x} y={tileGround(region).y} width={tileGround(region).w} height={tileGround(region).h} className="minimap-mark" /> : null}
            {point ? <circle data-map-mark cx={point.x * TILE_W + TILE_W / 2} cy={point.y * TILE_H + TILE_H / 2} r={40} className="minimap-dot" /> : null}
            <rect x={cam.x} y={cam.y} width={viewport.w} height={viewport.h} className="minimap-view" />
            {me ? <circle data-map-me cx={me.x * TILE_W + TILE_W / 2} cy={me.y * TILE_H + TILE_H / 2} r={22} className="minimap-me" /> : null}
          </svg>
          {faded && faded.length > 0 && onRevive ? (
            <div className="minimap-faded" data-map-faded-list>
              <span className="placard smallcaps">faded</span>
              {faded.map((f) => (
                <button key={f.id} type="button" data-map-faded={f.id} aria-label={`Revive ${f.title}`} title="Bring it back onto the wall" onClick={() => onRevive(f.id)}>
                  {f.title}
                </button>
              ))}
            </div>
          ) : null}
          <div className="minimap-filters" role="group" aria-label="Light up">
            {(["hot", "new", "mine"] as Filter[]).map((f) => {
              const n = f === "hot" ? hot.size : f === "new" ? fresh.size : mine.size;
              return (
                <button key={f} type="button" className={"minimap-filter" + (filter === f ? " is-on" : "")} aria-pressed={filter === f} onClick={() => pick(f)} data-map-filter={f}>
                  {f}
                  {n ? <span className="n">{n}</span> : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
