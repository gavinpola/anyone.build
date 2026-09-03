import { useCallback, useRef, useState } from "react";
import { Heading, Stack, Text, useTick, type BlockMeta } from "@/kit";

/**
 * Example (dev/e2e only): the kind of thing the wall can now build — a tiny endless runner drawn on a
 * canvas, driven by the kit's useTick loop, input via React props. No requestAnimationFrame, no globals.
 */
export const block: BlockMeta = {
  id: "dino-run",
  title: "Dino run",
  description: "A tiny endless runner: press space or tap to jump the cactus.",
  order: 80,
  size: "lg",
};

const W = 600;
const H = 180;
const GROUND = H - 24;

type World = { x: number; y: number; vy: number; obstacles: number[]; speed: number; over: boolean; score: number };
const fresh = (): World => ({ x: 48, y: GROUND, vy: 0, obstacles: [W + 40], speed: 240, over: false, score: 0 });

export default function DinoRun() {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const world = useRef<World>(fresh());
  const [phase, setPhase] = useState<"idle" | "playing" | "over">("idle");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const running = phase === "playing";

  const jump = useCallback(() => {
    const w = world.current;
    if (w.over) {
      world.current = fresh();
      setScore(0);
      setPhase("playing");
      return;
    }
    if (w.y >= GROUND) w.vy = -520;
    setPhase("playing");
  }, []);

  useTick(
    (dt) => {
      const w = world.current;
      if (w.over) return;
      w.vy += 1500 * dt;
      w.y = Math.min(GROUND, w.y + w.vy * dt);
      w.speed += 6 * dt;
      w.score += dt * 10;
      for (let i = 0; i < w.obstacles.length; i++) w.obstacles[i]! -= w.speed * dt;
      if (w.obstacles[0]! < -20) {
        w.obstacles.shift();
        w.obstacles.push(W + 120 + Math.random() * 220);
      }
      for (const ox of w.obstacles) {
        if (ox > w.x - 18 && ox < w.x + 18 && w.y > GROUND - 22) {
          w.over = true;
          setPhase("over");
          setBest((b) => Math.max(b, Math.floor(w.score)));
        }
      }
      setScore(Math.floor(w.score));

      const ctx = canvas.current?.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#111";
      ctx.fillRect(0, GROUND + 18, W, 2);
      ctx.fillRect(w.x - 10, w.y - 20, 20, 20); // runner
      ctx.fillStyle = "#2f7d4f";
      for (const ox of w.obstacles) ctx.fillRect(ox - 6, GROUND - 4, 12, 22); // cactus
    },
    { fps: 60, active: running },
  );

  return (
    <Stack className="p-5" gap={3}>
      <div className="flex items-baseline justify-between">
        <Heading level={2}>Dino run</Heading>
        <Text className="num text-[13px] text-muted">
          {score} · best {best}
        </Text>
      </div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Dino game: press space or tap to jump"
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "ArrowUp") {
            e.preventDefault();
            jump();
          }
        }}
        onPointerDown={jump}
        className="relative w-full cursor-pointer overflow-hidden rounded-md border border-line bg-paper-2 outline-none focus:border-ink"
        style={{ aspectRatio: `${W} / ${H}` }}
      >
        <canvas ref={canvas} width={W} height={H} className="h-full w-full" />
        {!running ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Text className="rounded-full bg-ink px-3 py-1 text-[13px] text-paper">
              {phase === "over" ? "Game over — space to retry" : "Press space or tap to start"}
            </Text>
          </div>
        ) : null}
      </div>
    </Stack>
  );
}
