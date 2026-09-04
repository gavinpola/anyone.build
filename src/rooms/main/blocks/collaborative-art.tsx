import { useCallback, useEffect, useRef, useState } from "react";
import { Row, Stack, Text, cn, useStore, useViewer } from "@/kit";
import type { BlockMeta } from "@/kit";
import { motion } from "motion/react";
import { Eraser } from "lucide-react";

export const block: BlockMeta = {
  id: "collaborative-art",
  title: "Open canvas",
  description: "One glowing canvas for the whole wall — every stroke shows up for everyone, live.",
  order: 5,
  size: "full",
};

const W = 960;
const H = 420;
const SIZE_MIN = 2; // world px — smallest brush/eraser radius
const SIZE_MAX = 40; // world px — largest brush/eraser radius
const MAX_STROKES = 200;
const MAX_POINTS = 90;

const clampSize = (n: number) => Math.max(SIZE_MIN, Math.min(SIZE_MAX, Math.round(n)));

const COLORS = ["#ff4d6d", "#ffd84d", "#4dff88", "#4dd8ff", "#b44dff", "#ffffff"];

type Pt = { x: number; y: number };
type Stroke = { color: string; width: number; points: Pt[] };

const makeKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export default function CollaborativeArt() {
  // an open: namespace is a whiteboard: anyone can erase anyone's strokes
  const { docs, put, remove, removeMany, ready } = useStore<Stroke>("open:collab-art");
  const { signedIn } = useViewer();
  const [color, setColor] = useState<string>(COLORS[0] ?? "#ff4d6d");
  const [tool, setTool] = useState<"brush" | "eraser">("brush");
  const [brushSize, setBrushSize] = useState(4); // world px radius of the brush
  const [eraserSize, setEraserSize] = useState(14); // world px radius of the eraser
  const [pointer, setPointer] = useState<{ fx: number; fy: number } | null>(null);
  const size = tool === "eraser" ? eraserSize : brushSize;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const toolRef = useRef(tool);
  const drawingRef = useRef(false);
  const lastRef = useRef<Pt | null>(null);
  const localRef = useRef<Stroke | null>(null);
  const docsRef = useRef(docs);
  const modRef = useRef(new Map<string, Stroke[]>()); // key -> replacement segments ([] = fully erased), previewed locally
  useEffect(() => {
    docsRef.current = docs;
    const live = new Set(docs.map((d) => d.key));
    for (const k of modRef.current.keys()) if (!live.has(k)) modRef.current.delete(k);
  }, [docs]);

  // scroll wheel resizes the active tool while hovering the canvas (non-passive, so the page doesn't scroll)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      const step = e.shiftKey ? 4 : 1;
      if (toolRef.current === "eraser") setEraserSize((s) => clampSize(s + dir * step));
      else setBrushSize((s) => clampSize(s + dir * step));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, s: Stroke) => {
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 12;
    const first = s.points[0];
    if (!first) return;
    if (s.points.length === 1) {
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(first.x, first.y, s.width / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (const pt of s.points.slice(1)) ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0d0b09";
    ctx.fillRect(0, 0, W, H);
    // faint grid so the canvas feels like an instrument panel
    ctx.strokeStyle = "rgba(255,255,255,0.035)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 48) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let y = 0; y <= H; y += 48) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
    for (const d of docs) {
      const segs = modRef.current.get(d.key);
      if (segs) for (const s of segs) drawStroke(ctx, s);
      else drawStroke(ctx, d.value);
    }
    if (localRef.current) drawStroke(ctx, localRef.current);
  }, [docs, drawStroke]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>): Pt => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.y) / rect.height) * H,
    };
  };

  const commit = (s: Stroke) => {
    put(makeKey(), s);
    const all = docsRef.current;
    const excess = all.length - (MAX_STROKES - 1);
    if (excess > 0) {
      const sorted = [...all].sort((a, b) => a.at - b.at);
      for (const d of sorted.slice(0, excess)) remove(d.key);
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = getPos(e);
    setPointer({ fx: p.x / W, fy: p.y / H });
    drawingRef.current = true;
    if (tool === "eraser") {
      eraseAt(p);
      return;
    }
    lastRef.current = p;
    localRef.current = { color, width: brushSize, points: [p] };
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = getPos(e);
    setPointer({ fx: p.x / W, fy: p.y / H });
    if (!drawingRef.current) return;
    if (tool === "eraser") {
      eraseAt(p);
      return;
    }
    if (!localRef.current) return;
    const last = lastRef.current;
    if (!last) {
      lastRef.current = p;
      return;
    }
    if (Math.hypot(p.x - last.x, p.y - last.y) < 1.5) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.strokeStyle = localRef.current.color;
      ctx.lineWidth = localRef.current.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = localRef.current.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    localRef.current.points.push(p);
    if (localRef.current.points.length >= MAX_POINTS) {
      const done = localRef.current;
      localRef.current = { color: done.color, width: done.width, points: [p] };
      commit(done);
    }
    lastRef.current = p;
  };

  const onPointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (tool === "eraser") {
      flushErase();
      return;
    }
    lastRef.current = null;
    const s = localRef.current;
    localRef.current = null;
    if (s && s.points.length > 0) commit(s);
  };

  /** Split a stroke into the segments that survive an eraser centred at p ([] = nothing survives). */
  const cutStroke = (s: Stroke, p: Pt, r: number): Stroke[] => {
    const segs: Stroke[] = [];
    let run: Pt[] = [];
    for (const pt of s.points) {
      if (Math.hypot(pt.x - p.x, pt.y - p.y) <= r) {
        if (run.length > 0) {
          segs.push({ color: s.color, width: s.width, points: run });
          run = [];
        }
      } else {
        run.push(pt);
      }
    }
    if (run.length > 0) segs.push({ color: s.color, width: s.width, points: run });
    return segs;
  };

  /** Rub out the part of every stroke under the circular eraser at p — previewed instantly, sent when the drag ends. */
  const eraseAt = (p: Pt) => {
    let hit = false;
    for (const d of docsRef.current) {
      if (modRef.current.has(d.key)) continue;
      const segs = cutStroke(d.value, p, eraserSize + d.value.width / 2);
      const intact = segs.length === 1 && segs[0]!.points.length === d.value.points.length;
      if (intact) continue;
      modRef.current.set(d.key, segs);
      hit = true;
    }
    if (hit) redraw();
  };

  const flushErase = () => {
    if (modRef.current.size === 0) return;
    const entries = Array.from(modRef.current);
    modRef.current = new Map();
    const toRemove: string[] = [];
    const toPut: [string, Stroke][] = [];
    for (const [key, segs] of entries) {
      toRemove.push(key);
      for (const s of segs) toPut.push([makeKey(), s]);
    }
    removeMany(toRemove);
    for (const [k, s] of toPut) put(k, s);
    // splitting a stroke adds strokes, so keep only the newest ~MAX_STROKES
    const excess = docsRef.current.length - toRemove.length + toPut.length - MAX_STROKES;
    if (excess > 0) {
      const sorted = [...docsRef.current].sort((a, b) => a.at - b.at);
      for (const d of sorted.slice(0, excess)) remove(d.key);
    }
  };

  return (
    <Stack className="p-5 sm:p-6" gap={3}>
      <Stack gap={1}>
        <Text className="placard smallcaps text-muted">open canvas — everyone draws here</Text>
        <Text className="max-w-2xl">
          One canvas for the whole wall. Pick a color and paint — every stroke appears for everyone in real time. A circular eraser rubs out only the part you touch.
        </Text>
      </Stack>

      <div className="relative overflow-hidden rounded-lg border border-line bg-[#0d0b09]">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className={cn("block h-auto w-full touch-none", tool === "eraser" ? "cursor-cell" : "cursor-crosshair")}
          aria-label="Collaborative drawing canvas. Draw or erase with your mouse or finger; scroll to resize your tool."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => setPointer(null)}
        />
        {pointer && (
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-full border"
            style={{
              left: `${pointer.fx * 100}%`,
              top: `${pointer.fy * 100}%`,
              width: `${(size * 2 * 100) / W}%`,
              paddingTop: `${(size * 2 * 100) / W}%`,
              transform: "translate(-50%, -50%)",
              borderColor: tool === "eraser" ? "rgba(255,255,255,0.7)" : color,
              backgroundColor: tool === "eraser" ? "rgba(255,255,255,0.15)" : `${color}22`,
              boxShadow: "0 0 0 1px rgba(0,0,0,0.3)",
            }}
          />
        )}
        {!signedIn && (
          <div className="pointer-events-none absolute inset-x-0 flex justify-center pt-3">
            <span className="rounded-full border border-line bg-[#0d0b09]/80 px-3 py-1 text-[12px] text-[#f4efe3]/80">
              drawing as a guest — sign in to put your name on your strokes
            </span>
          </div>
        )}
      </div>

      <Row gap={3} className="flex-wrap items-center justify-between">
        <Row gap={3} className="flex-wrap items-center">
          <Row gap={2}>
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`draw in ${c}`}
                onClick={() => {
                  setColor(c);
                  setTool("brush");
                }}
                aria-pressed={tool === "brush" && color === c}
                className={cn(
                  "h-7 w-7 rounded-full border transition",
                  tool === "brush" && color === c ? "scale-110 border-white/80" : "border-white/20 hover:scale-105",
                )}
                style={{ backgroundColor: c, boxShadow: tool === "brush" && color === c ? `0 0 12px ${c}` : undefined }}
              />
            ))}
          </Row>
          <label className="flex items-center gap-2 text-[12px] text-muted">
            <span className="whitespace-nowrap">{tool === "eraser" ? "eraser" : "brush"} size</span>
            <input
              type="range"
              min={SIZE_MIN}
              max={SIZE_MAX}
              value={size}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (tool === "eraser") setEraserSize(v);
                else setBrushSize(v);
              }}
              aria-label={`${tool} radius, ${SIZE_MIN} to ${SIZE_MAX} pixels`}
              className="w-24 sm:w-32"
              style={{ accentColor: "#f4efe3" }}
            />
            <span className="w-8 text-right text-[12px] tabular-nums text-ink">{size}px</span>
          </label>
        </Row>
        <button
          type="button"
          aria-label="eraser"
          aria-pressed={tool === "eraser"}
          onClick={() => setTool("eraser")}
          title="Eraser: rub out parts of any stroke, anyone's"
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] transition",
            tool === "eraser" ? "border-ink bg-ink text-paper" : "border-line text-ink-2 hover:border-line-2",
          )}
        >
          <Eraser size={13} />
          erase
        </button>
      </Row>

      <Text muted className="text-sm text-muted">
        {"brush or eraser, it's everyone's canvas — scroll the canvas or drag the slider to resize your tool"}
      </Text>

      <Row gap={2} className="text-[13px]">
        <motion.span
          className="inline-block h-2 w-2 rounded-full bg-[#4dff88]"
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        />
        <Text muted>
          {ready ? `${docs.length} stroke${docs.length === 1 ? "" : "s"} on the canvas` : "loading strokes…"}
        </Text>
      </Row>
    </Stack>
  );
}