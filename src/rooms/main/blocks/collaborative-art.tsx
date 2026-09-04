import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Row, Stack, Text, cn, useStore, useViewer } from "@/kit";
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
const MAX_STROKES = 200;
const MAX_POINTS = 90;

const COLORS = ["#ff4d6d", "#ffd84d", "#4dff88", "#4dd8ff", "#b44dff", "#ffffff"];

type Pt = { x: number; y: number };
type Stroke = { color: string; width: number; points: Pt[] };

const makeKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export default function CollaborativeArt() {
  const { docs, put, remove, ready } = useStore<Stroke>("collab-art");
  const { signedIn } = useViewer();
  const [color, setColor] = useState<string>(COLORS[0] ?? "#ff4d6d");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<Pt | null>(null);
  const localRef = useRef<Stroke | null>(null);
  const docsRef = useRef(docs);
  useEffect(() => {
    docsRef.current = docs;
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
    for (const d of docs) drawStroke(ctx, d.value);
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
    if (!drawingRef.current || !localRef.current) return;
    const p = getPos(e);
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
    lastRef.current = null;
    const s = localRef.current;
    localRef.current = null;
    if (s && s.points.length > 0) commit(s);
  };

  const clear = () => {
    for (const d of docsRef.current) remove(d.key); // only your own strokes go; the store keeps everyone else's
  };

  return (
    <Stack className="p-5 sm:p-6" gap={3}>
      <Stack gap={1}>
        <Text className="placard smallcaps text-muted">open canvas — everyone draws here</Text>
        <Text className="max-w-2xl">
          One canvas for the whole wall. Pick a color, draw a stroke, and it appears for everyone in real time.
        </Text>
      </Stack>

      <div className="relative overflow-hidden rounded-lg border border-line bg-[#0d0b09]">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="block h-auto w-full touch-none"
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
              onClick={() => setColor(c)}
              className={cn(
                "h-7 w-7 rounded-full border transition",
                color === c ? "scale-110 border-white/80" : "border-white/20 hover:scale-105",
              )}
              style={{ backgroundColor: c, boxShadow: color === c ? `0 0 12px ${c}` : undefined }}
            />
          ))}
        </Row>
        <Button variant="secondary" size="sm" onClick={clear} disabled={docs.length === 0}>
          <Eraser size={14} />
          Clear
        </Button>
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