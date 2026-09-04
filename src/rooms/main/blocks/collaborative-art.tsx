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
const BRUSH = 4;
const ERASER_R = 14; // world px around the pointer that the eraser rubs out
const MAX_STROKES = 200;
const MAX_POINTS = 90;

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

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<Pt | null>(null);
  const localRef = useRef<Stroke | null>(null);
  const docsRef = useRef(docs);
  const erasedRef = useRef(new Set<string>()); // strokes rubbed out locally, ahead of the server
  const eraseBatchRef = useRef(new Set<string>()); // keys to send when the drag ends
  useEffect(() => {
    docsRef.current = docs;
    const live = new Set(docs.map((d) => d.key));
    for (const k of erasedRef.current) if (!live.has(k)) erasedRef.current.delete(k);
  }, [docs]);

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
    for (const d of docs) if (!erasedRef.current.has(d.key)) drawStroke(ctx, d.value);
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
    drawingRef.current = true;
    if (tool === "eraser") {
      eraseAt(p);
      return;
    }
    lastRef.current = p;
    localRef.current = { color, width: BRUSH, points: [p] };
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, BRUSH / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const p = getPos(e);
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

  /** Distance from p to the stroke's polyline (a single point is a dot). */
  const distanceTo = (s: Stroke, p: Pt): number => {
    const pts = s.points;
    if (pts.length === 0) return Infinity;
    const first = pts[0]!;
    if (pts.length === 1) return Math.hypot(p.x - first.x, p.y - first.y);
    let best = Infinity;
    let a = first;
    for (const b of pts.slice(1)) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
      const d = Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
      if (d < best) best = d;
      a = b;
    }
    return best;
  };

  /** Rub out every stroke under the eraser at p: gone on screen at once, sent when the drag ends. */
  const eraseAt = (p: Pt) => {
    let hit = false;
    for (const d of docsRef.current) {
      if (erasedRef.current.has(d.key)) continue;
      if (distanceTo(d.value, p) <= d.value.width / 2 + ERASER_R) {
        erasedRef.current.add(d.key);
        eraseBatchRef.current.add(d.key);
        hit = true;
      }
    }
    if (hit) redraw();
  };

  const flushErase = () => {
    if (eraseBatchRef.current.size === 0) return;
    removeMany(Array.from(eraseBatchRef.current));
    eraseBatchRef.current.clear();
  };

  return (
    <Stack className="p-5 sm:p-6" gap={3}>
      <Stack gap={1}>
        <Text className="placard smallcaps text-muted">open canvas — everyone draws here</Text>
        <Text className="max-w-2xl">
          One canvas for the whole wall. Pick a color, draw a stroke, and it appears for everyone in real time. Anyone can erase, too.
        </Text>
      </Stack>

      <div className="relative overflow-hidden rounded-lg border border-line bg-[#0d0b09]">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className={cn("block h-auto w-full touch-none", tool === "eraser" ? "cursor-cell" : "cursor-crosshair")}
          aria-label="Collaborative drawing canvas. Draw with your mouse or finger."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {!signedIn && (
          <div className="pointer-events-none absolute inset-x-0 flex justify-center pt-3">
            <span className="rounded-full border border-line bg-[#0d0b09]/80 px-3 py-1 text-[12px] text-[#f4efe3]/80">
              drawing as a guest — sign in to put your name on your strokes
            </span>
          </div>
        )}
      </div>

      <Row gap={2} className="justify-between">
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
        <button
          type="button"
          aria-label="eraser"
          aria-pressed={tool === "eraser"}
          onClick={() => setTool("eraser")}
          title="Eraser: rub out any stroke, anyone's"
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] transition",
            tool === "eraser" ? "border-ink bg-ink text-paper" : "border-line text-ink-2 hover:border-line-2",
          )}
        >
          <Eraser size={13} />
          erase
        </button>
      </Row>

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