import { useRef, useState } from "react";
import { Stack, Text } from "@/kit";
import type { BlockMeta } from "@/kit";
import { useTick, useKeys, useHighScores, HighScores } from "@/kit";

export const block: BlockMeta = {
  id: "mango-weave-game",
  title: "Mango weave",
  description: "A mango weaving through falling trees. Steer with the arrow keys or drag to dodge.",
  order: 7,
  size: "full",
  place: { x: -1, y: -2, w: 2 }, // tiles: one left of the origin, two up, two wide
};

const W = 640;
const H = 300;
const GROUND = H - 30; // grass line at the bottom
const MANGO_Y = GROUND - 18; // mango centre (canvas y grows downward, so up is smaller y)
const MANGO_R = 15;
const MARGIN = MANGO_R + 10;
const MOVE_SPEED = 330; // px/s while an arrow key is held

type Phase = "ready" | "playing" | "over";
type Tree = { x: number; y: number; w: number; h: number; canopy: number; speed: number };
type Game = {
  phase: Phase;
  x: number;
  trees: Tree[];
  score: number; // ~12 points per second survived
  spawnIn: number;
  speed: number; // base tree speed, ramps with score
  best: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export default function MangoWeaveGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keys = useKeys();
  const game = useRef<Game>({
    phase: "ready",
    x: W / 2,
    trees: [],
    score: 0,
    spawnIn: 0.8,
    speed: 150,
    best: 0,
  });
  const [phase, setPhase] = useState<Phase>("ready");
  const [lastScore, setLastScore] = useState(0);
  const { submit } = useHighScores("mango-weave-game");

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const g = game.current;

    // orchard sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#eef7e6");
    sky.addColorStop(1, "#dcead2");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // grass with a few blades
    ctx.fillStyle = "#e8ead9";
    ctx.fillRect(0, 0, W, GROUND);
    ctx.strokeStyle = "#c2cd9f";
    ctx.lineWidth = 2;
    for (let i = 0; i < 40; i++) {
      const bx = (i * 37 + 13) % W;
      const by = GROUND - 8 - ((i * 53) % 14);
      ctx.beginPath();
      ctx.moveTo(bx, by + 6);
      ctx.quadraticCurveTo(bx + (i % 2 ? 3 : -3), by - 2, bx, by - 2);
      ctx.stroke();
    }

    // the mango's lane
    ctx.fillStyle = "#d7dcc0";
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = "#c3c9a7";
    ctx.fillRect(0, GROUND, W, 3);

    // trees: canopy circle above the trunk; both fall toward the lane
    for (const t of g.trees) {
      const ty = t.y; // trunk start
      ctx.fillStyle = "#3f9d4e";
      ctx.beginPath();
      ctx.arc(t.x, ty - t.canopy * 0.62, t.canopy, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#57b25f";
      ctx.beginPath();
      ctx.arc(t.x - t.canopy * 0.22, ty - t.canopy * 0.95, t.canopy * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#8a5a2b";
      ctx.fillRect(t.x - t.w / 2, ty, t.w, t.h);
      ctx.fillStyle = "#6f4520";
      ctx.fillRect(t.x - t.w / 2, ty + t.h - 4, t.w, 4);
    }

    // mango
    const mx = g.x;
    ctx.fillStyle = "#e8741a";
    ctx.beginPath();
    ctx.ellipse(mx, MANGO_Y + 2, MANGO_R + 7, MANGO_R + 1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff9d2e";
    ctx.beginPath();
    ctx.ellipse(mx - 4, MANGO_Y - 3, MANGO_R + 3, MANGO_R - 4, -0.25, 0, Math.PI * 2);
    ctx.fill();
    // stem + leaf
    ctx.strokeStyle = "#6f4520";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(mx + 3, MANGO_Y - MANGO_R - 2);
    ctx.lineTo(mx + 5, MANGO_Y - MANGO_R - 9);
    ctx.stroke();
    ctx.fillStyle = "#3f9d4e";
    ctx.beginPath();
    ctx.ellipse(mx + 14, MANGO_Y - MANGO_R - 10, 9, 4, 0.55, 0, Math.PI * 2);
    ctx.fill();
    // face
    ctx.fillStyle = "#5b2c10";
    ctx.beginPath();
    ctx.arc(mx - 6, MANGO_Y - 1, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(mx + 6, MANGO_Y - 1, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#5b2c10";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(mx, MANGO_Y + 5, 6, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();

    // score
    ctx.fillStyle = "#4a4f33";
    ctx.font = "600 15px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillText(`score ${Math.floor(g.score)}`, 14, 26);
    ctx.textAlign = "right";
    ctx.fillText(`best ${g.best}`, W - 14, 26);
  };

  const reset = () => {
    const g = game.current;
    g.phase = "playing";
    g.x = W / 2;
    g.trees = [];
    g.score = 0;
    g.spawnIn = 0.8;
    g.speed = 150;
    setPhase("playing");
  };

  const end = () => {
    const g = game.current;
    const score = Math.floor(g.score);
    g.phase = "over";
    g.best = Math.max(g.best, score);
    setLastScore(score);
    setPhase("over");
    submit(score);
  };

  // circle (mango, shrunk for leniency) vs each tree's canopy circle and trunk rect
  const hit = () => {
    const g = game.current;
    const mx = g.x;
    const my = MANGO_Y;
    const mr = MANGO_R - 3;
    for (const t of g.trees) {
      const cxp = t.x;
      const cyp = t.y - t.canopy * 0.62;
      const cr = t.canopy * 0.78;
      const dx = mx - cxp;
      const dy = my - cyp;
      if (dx * dx + dy * dy < (mr + cr) * (mr + cr)) return true;
      const nx = clamp(mx, t.x - t.w / 2 + 4, t.x + t.w / 2 - 4);
      const ny = clamp(my, t.y + 4, t.y + t.h - 4);
      const ddx = mx - nx;
      const ddy = my - ny;
      if (ddx * ddx + ddy * ddy < mr * mr) return true;
    }
    return false;
  };

  const moveToPointer = (e: { clientX: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    game.current.x = clamp(((e.clientX - rect.left) / rect.width) * W, MARGIN, W - MARGIN);
  };

  useTick(
    (dt) => {
      const g = game.current;

      if (g.phase !== "playing") {
        // start on the first key press
        if (
          keys.has("ArrowLeft") ||
          keys.has("ArrowRight") ||
          keys.has("a") ||
          keys.has("d") ||
          keys.has(" ")
        ) {
          reset();
        }
      } else {
        const dir =
          (keys.has("ArrowLeft") || keys.has("a") ? -1 : 0) +
          (keys.has("ArrowRight") || keys.has("d") ? 1 : 0);
        g.x = clamp(g.x + dir * MOVE_SPEED * dt, MARGIN, W - MARGIN);

        g.score += dt * 12;
        g.speed = Math.min(360, 150 + g.score * 0.3); // faster trees the longer you survive
        g.spawnIn -= dt;
        if (g.spawnIn <= 0) {
          const canopy = 16 + Math.random() * 13;
          const margin = 30 + canopy;
          g.trees.push({
            x: margin + Math.random() * (W - margin * 2),
            y: -canopy * 1.2 - 20,
            w: 12 + Math.random() * 8,
            h: canopy * (1.2 + Math.random() * 0.8),
            canopy,
            speed: g.speed * (0.7 + Math.random() * 0.6),
          });
          g.spawnIn = Math.max(0.45, 1.05 - g.score / 4500);
        }
        for (const t of g.trees) t.y += t.speed * dt;
        g.trees = g.trees.filter((t) => t.y < H + 60);

        if (hit()) end();
      }

      draw();
    },
    { fps: 60 },
  );

  return (
    <Stack className="p-5 sm:p-6" gap={3}>
      <Text className="max-w-2xl">
        A mango weaving through falling trees. Steer with the arrow keys (or drag with your finger) —
        every tree you dodge keeps the run going.
      </Text>
      <div
        tabIndex={0}
        role="application"
        aria-label="Mango weave. Arrow keys or drag to move, dodge the trees."
        className="relative w-full cursor-pointer select-none touch-none overflow-hidden rounded-lg border border-line outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onKeyDown={(e) => {
          if (["ArrowLeft", "ArrowRight", "a", "d", " "].includes(e.key)) {
            e.preventDefault();
            if (game.current.phase !== "playing") reset();
          }
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          if (game.current.phase !== "playing") reset();
          moveToPointer(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons & 1) moveToPointer(e);
        }}
      >
        <canvas ref={canvasRef} width={W} height={H} className="block h-auto w-full" />
        {phase !== "playing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#1b1712]/40 text-center">
            <p className="font-display text-xl text-white drop-shadow">
              {phase === "ready" ? "Mango weave" : "Wham — tree!"}
            </p>
            <p className="max-w-xs text-sm text-white/90 drop-shadow">
              {phase === "ready"
                ? "tap or press ← or → to start dodging the trees"
                : `you weaved for ${lastScore} points — tap to go again`}
            </p>
          </div>
        )}
      </div>
      <HighScores game="mango-weave-game" limit={5} title="Longest weaves, everyone" />
    </Stack>
  );
}