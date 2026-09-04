import { useRef, useState } from "react";
import { Stack, Text } from "@/kit";
import type { BlockMeta } from "@/kit";
import { useTick } from "@/kit";

export const block: BlockMeta = {
  id: "dino-game",
  title: "Dino dash",
  description: "A tiny side-scrolling dino game on the wall. Jump the cacti!",
  order: 4,
  size: "full",
};

const W = 640;
const H = 240;
const GROUND = 196;
const DINO = { x: 56, w: 34, h: 38 };
const GRAVITY = 1500;
const JUMP_V = -560;

type Phase = "ready" | "playing" | "over";
type Cactus = { x: number; w: number; h: number };
type Game = {
  phase: Phase;
  dinoY: number; // dino's bottom above the ground
  vy: number;
  cacti: Cactus[];
  speed: number;
  distance: number;
  spawnIn: number;
  best: number;
};

export default function DinoGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const game = useRef<Game>({
    phase: "ready",
    dinoY: 0,
    vy: 0,
    cacti: [],
    speed: 190,
    distance: 0,
    spawnIn: 1.1,
    best: 0,
  });
  const [phase, setPhase] = useState<Phase>("ready");
  const [lastScore, setLastScore] = useState(0);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const g = game.current;

    ctx.clearRect(0, 0, W, H);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#fdf6e3");
    sky.addColorStop(1, "#f2e8cf");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // ground
    ctx.fillStyle = "#d8c9a3";
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = "#b7a678";
    ctx.fillRect(0, GROUND, W, 3);

    // cacti
    for (const c of g.cacti) {
      ctx.fillStyle = "#3f7d4e";
      ctx.fillRect(c.x, GROUND - c.h, c.w, c.h);
      ctx.fillStyle = "#2f5f3c";
      ctx.fillRect(c.x + c.w / 2 - 2, GROUND - c.h - 8, 4, 8);
    }

    // dino
    const dinoBottom = GROUND - g.dinoY;
    ctx.fillStyle = "#4a4a4a";
    ctx.fillRect(DINO.x, dinoBottom - DINO.h, DINO.w, DINO.h);
    ctx.fillStyle = "#fff";
    ctx.fillRect(DINO.x + DINO.w - 10, dinoBottom - DINO.h + 6, 7, 7);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(DINO.x + DINO.w - 8, dinoBottom - DINO.h + 8, 3, 3);
    ctx.fillStyle = "#333";
    ctx.fillRect(DINO.x + 4, dinoBottom - 6, 8, 6);
    ctx.fillRect(DINO.x + DINO.w - 12, dinoBottom - 6, 8, 6);

    // score
    ctx.fillStyle = "#5b4a2f";
    ctx.font = "600 15px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillText(`score ${Math.floor(g.distance / 10)}`, 14, 24);
    ctx.textAlign = "right";
    ctx.fillText(`best ${g.best}`, W - 14, 24);
  };

  const reset = () => {
    const g = game.current;
    g.phase = "playing";
    g.dinoY = 0;
    g.vy = 0;
    g.cacti = [];
    g.speed = 190;
    g.distance = 0;
    g.spawnIn = 1.1;
    setPhase("playing");
  };

  const jump = () => {
    const g = game.current;
    if (g.phase === "ready" || g.phase === "over") {
      reset();
      return;
    }
    if (g.dinoY <= 0) g.vy = JUMP_V;
  };

  useTick(
    (dt) => {
      const g = game.current;
      if (g.phase === "playing") {
        g.distance += g.speed * dt;
        g.speed = Math.min(430, g.speed + 8 * dt);

        // dino physics
        g.vy += GRAVITY * dt;
        g.dinoY += g.vy * dt;
        if (g.dinoY <= 0) {
          g.dinoY = 0;
          g.vy = 0;
        }

        // spawn cacti
        g.spawnIn -= dt;
        if (g.spawnIn <= 0) {
          g.cacti.push({ x: W + 10, w: 14 + Math.random() * 6, h: 22 + Math.random() * 22 });
          g.spawnIn = Math.max(0.55, 1.15 - g.distance / 40000);
        }

        // move
        for (const c of g.cacti) c.x -= g.speed * dt;
        g.cacti = g.cacti.filter((c) => c.x + c.w > -20);

        // collision (slightly forgiving hitboxes)
        const dinoBottom = GROUND - g.dinoY;
        const dinoLeft = DINO.x + 4;
        const dinoRight = DINO.x + DINO.w - 4;
        const dinoTop = dinoBottom - DINO.h + 4;
        for (const c of g.cacti) {
          if (
            c.x + 2 < dinoRight &&
            c.x + c.w - 2 > dinoLeft &&
            GROUND - c.h + 2 < dinoBottom &&
            GROUND > dinoTop
          ) {
            g.phase = "over";
            g.best = Math.max(g.best, Math.floor(g.distance / 10));
            setLastScore(Math.floor(g.distance / 10));
            setPhase("over");
            break;
          }
        }
      }
      draw();
    },
    { fps: 60 },
  );

  return (
    <Stack className="p-5 sm:p-6" gap={3}>
      <Text className="max-w-2xl">A tiny dino dash — tap or press space to jump the cacti.</Text>
      <div
        tabIndex={0}
        role="button"
        aria-label="Dino game. Tap or press space to jump."
        className="relative w-full cursor-pointer select-none overflow-hidden rounded-lg border border-line outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "ArrowUp") {
            e.preventDefault();
            jump();
          }
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          jump();
        }}
      >
        <canvas ref={canvasRef} width={W} height={H} className="block h-auto w-full" />
        {phase !== "playing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#1b1712]/40 text-center">
            <p className="font-display text-xl text-white drop-shadow">
              {phase === "ready" ? "Dino dash" : "Game over"}
            </p>
            <p className="text-sm text-white/90 drop-shadow">
              {phase === "ready"
                ? "tap or press space to start"
                : `you scored ${lastScore} — tap to run again`}
            </p>
          </div>
        )}
      </div>
    </Stack>
  );
}
