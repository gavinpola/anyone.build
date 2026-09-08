import { useRef, useState } from "react";
import { Stack, Text } from "@/kit";
import type { BlockMeta } from "@/kit";
import { useTick, useHighScores, HighScores } from "@/kit";

export const block: BlockMeta = {
  id: "gta-browser",
  title: "GTA: browser edition",
  description: "A tiny overhead city cruise. Steer with the arrow keys, don't hit the buildings.",
  order: 5,
  size: "full",
};

const W = 640;
const H = 400;

// Car physics: heading is in radians, 0 = pointing up on the canvas (canvas y grows downward,
// so forward motion subtracts from y). Left/right rotate the heading, up accelerates,
// down brakes or reverses. Collisions are a circle (radius CAR_R) vs. building rects.
const ACCEL = 260;
const BRAKE = 420;
const MAX_SPEED = 240;
const REVERSE_MAX = 90;
const TURN = 2.6; // rad/s at full speed
const CAR_R = 13; // collision circle radius
const MAX_CRASHES = 3;

type Building = { x: number; y: number; w: number; h: number };
type Phase = "ready" | "playing" | "over";
type Game = {
  phase: Phase;
  x: number;
  y: number;
  heading: number;
  speed: number;
  distance: number;
  crashes: number;
  flash: number;
  best: number;
  buildings: Building[];
};

// City blocks: roads run between these regions (horizontal roads at y 90-150 and 250-310,
// vertical roads at x 140-200 and 440-500). Each region becomes one building, inset 6px.
const REGIONS: [number, number, number, number][] = [
  [0, 0, 140, 90],
  [200, 0, 440, 90],
  [500, 0, 640, 90],
  [0, 150, 140, 250],
  [200, 150, 440, 250],
  [500, 150, 640, 250],
  [0, 310, 140, 400],
  [200, 310, 440, 400],
  [500, 310, 640, 400],
];
const BUILDINGS: Building[] = REGIONS.map(([x1, y1, x2, y2]) => ({
  x: x1 + 6,
  y: y1 + 6,
  w: x2 - x1 - 12,
  h: y2 - y1 - 12,
}));
const ROADS: [number, number, number, number, boolean][] = [
  [0, 90, W, 60, true],
  [0, 250, W, 60, true],
  [140, 0, 60, H, false],
  [440, 0, 60, H, false],
];

export default function GtaBrowser() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keys = useRef<Set<string>>(new Set());
  const game = useRef<Game>({
    phase: "ready",
    x: 170,
    y: 200,
    heading: 0,
    speed: 0,
    distance: 0,
    crashes: 0,
    flash: 0,
    best: 0,
    buildings: BUILDINGS,
  });
  const [phase, setPhase] = useState<Phase>("ready");
  const [lastScore, setLastScore] = useState(0);
  const { submit } = useHighScores("gta-browser");

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const g = game.current;

    ctx.clearRect(0, 0, W, H);

    // asphalt
    ctx.fillStyle = "#3a3f44";
    ctx.fillRect(0, 0, W, H);

    // roads
    ctx.fillStyle = "#4a5058";
    for (const [rx, ry, rw, rh] of ROADS) ctx.fillRect(rx, ry, rw, rh);

    // dashed center lines
    ctx.strokeStyle = "#e8c84a";
    ctx.lineWidth = 3;
    ctx.setLineDash([18, 14]);
    for (const [rx, ry, rw, rh, horiz] of ROADS) {
      ctx.beginPath();
      if (horiz) {
        ctx.moveTo(rx, ry + rh / 2);
        ctx.lineTo(rx + rw, ry + rh / 2);
      } else {
        ctx.moveTo(rx + rw / 2, ry);
        ctx.lineTo(rx + rw / 2, ry + rh);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // buildings
    for (const b of g.buildings) {
      ctx.fillStyle = "#7d6b52";
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = "#5f4f3d";
      ctx.fillRect(b.x, b.y, b.w, 3);
      ctx.fillStyle = "#8f7c60";
      ctx.fillRect(b.x + 5, b.y + 9, b.w - 10, 4);
    }

    // car (heading 0 = up; the sprite's nose is drawn at negative y)
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.heading);
    ctx.fillStyle = "#1c1c1e";
    ctx.fillRect(-14, -9, 6, 18);
    ctx.fillRect(8, -9, 6, 18);
    ctx.fillStyle = "#c0392b";
    ctx.fillRect(-12, -7, 24, 14);
    ctx.fillStyle = "#a8d8e8";
    ctx.fillRect(-8, -6, 16, 5);
    ctx.fillStyle = "#8e2b22";
    ctx.fillRect(-12, 2, 24, 5);
    ctx.restore();

    // crash flash
    if (g.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(1, g.flash / 0.35) * 0.7})`;
      ctx.fillRect(0, 0, W, H);
    }

    // HUD
    ctx.fillStyle = "#f4e9d0";
    ctx.font = "600 15px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillText(`score ${Math.floor(g.distance / 10)}`, 12, 24);
    ctx.textAlign = "right";
    ctx.fillText(`wanted ${"★".repeat(g.crashes)}${"☆".repeat(Math.max(0, MAX_CRASHES - g.crashes))}`, W - 12, 24);
  };

  const reset = () => {
    const g = game.current;
    g.phase = "playing";
    g.x = 170;
    g.y = 200;
    g.heading = 0;
    g.speed = 0;
    g.distance = 0;
    g.crashes = 0;
    g.flash = 0;
    setPhase("playing");
  };

  const crash = () => {
    const g = game.current;
    g.crashes += 1;
    g.flash = 0.35;
    g.speed = 0;
    if (g.crashes >= MAX_CRASHES) {
      g.phase = "over";
      const score = Math.floor(g.distance / 10);
      g.best = Math.max(g.best, score);
      setLastScore(score);
      submit(score);
      setPhase("over");
    }
  };

  const start = () => {
    if (game.current.phase !== "playing") reset();
  };

  useTick(
    (dt) => {
      const g = game.current;
      if (g.phase === "playing") {
        const k = keys.current;
        let turn = 0;
        if (k.has("ArrowLeft") || k.has("a")) turn -= 1;
        if (k.has("ArrowRight") || k.has("d")) turn += 1;
        let throttle = 0;
        if (k.has("ArrowUp") || k.has("w")) throttle += 1;
        if (k.has("ArrowDown") || k.has("s")) throttle -= 1;

        if (turn !== 0) {
          // turn rate scales with speed so the car can't spin in place
          const rate = TURN * Math.min(1, Math.abs(g.speed) / 50);
          g.heading += turn * rate * dt;
        }
        if (throttle > 0) {
          g.speed = Math.min(MAX_SPEED, g.speed + ACCEL * dt);
        } else if (throttle < 0) {
          g.speed = Math.max(-REVERSE_MAX, g.speed - BRAKE * dt);
        } else {
          const drag = 70;
          if (g.speed > 0) g.speed = Math.max(0, g.speed - drag * dt);
          else g.speed = Math.min(0, g.speed + drag * dt);
        }

        // heading 0 = up; canvas y grows downward so up is -y
        g.x += Math.sin(g.heading) * g.speed * dt;
        g.y -= Math.cos(g.heading) * g.speed * dt;

        g.distance += Math.abs(g.speed) * dt;

        // edges of the block: clamp and stop
        if (g.x < CAR_R) {
          g.x = CAR_R;
          g.speed = 0;
        }
        if (g.x > W - CAR_R) {
          g.x = W - CAR_R;
          g.speed = 0;
        }
        if (g.y < CAR_R) {
          g.y = CAR_R;
          g.speed = 0;
        }
        if (g.y > H - CAR_R) {
          g.y = H - CAR_R;
          g.speed = 0;
        }

        // buildings: push out of the rect and count a crash
        for (const b of g.buildings) {
          const nx = Math.max(b.x, Math.min(g.x, b.x + b.w));
          const ny = Math.max(b.y, Math.min(g.y, b.y + b.h));
          const dx = g.x - nx;
          const dy = g.y - ny;
          const d2 = dx * dx + dy * dy;
          if (d2 < CAR_R * CAR_R) {
            if (d2 > 0.0001) {
              const d = Math.sqrt(d2);
              g.x = nx + (dx / d) * (CAR_R + 0.5);
              g.y = ny + (dy / d) * (CAR_R + 0.5);
            } else {
              g.y = b.y - CAR_R - 0.5;
            }
            crash();
            break;
          }
        }
      }
      g.flash = Math.max(0, g.flash - dt);
      draw();
    },
    { fps: 60 },
  );

  return (
    <Stack
      tabIndex={0}
      role="application"
      aria-label="GTA browser edition. Arrow keys to drive, avoid the buildings, three crashes ends the run."
      className="p-5 sm:p-6 outline-none focus-visible:ring-2 focus-visible:ring-accent"
      gap={3}
      onKeyDown={(e) => {
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "w", "a", "s", "d"].includes(e.key)) {
          e.preventDefault();
          keys.current.add(e.key);
          start();
        }
      }}
      onKeyUp={(e) => {
        keys.current.delete(e.key);
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        start();
      }}
    >
      <Text className="max-w-2xl">
        A tiny overhead city cruise. Steer with the arrow keys (or the buttons), dodge the buildings —
        three crashes and you're busted.
      </Text>
      <Text muted className="text-[13px]">
        Arrow keys steer, don't hit the buildings.
      </Text>
      <div className="relative w-full cursor-pointer select-none overflow-hidden rounded-lg border border-line">
        <canvas ref={canvasRef} width={W} height={H} className="block h-auto w-full" />
        {phase !== "playing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#1b1712]/40 text-center">
            <p className="font-display text-xl text-white drop-shadow">
              {phase === "ready" ? "GTA: browser edition" : "Busted!"}
            </p>
            <p className="text-sm text-white drop-shadow">
              {phase === "ready"
                ? "tap or press an arrow key to start driving"
                : `you drove ${lastScore} blocks — tap to go again`}
            </p>
          </div>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {([
          ["◀", "ArrowLeft"],
          ["▲", "ArrowUp"],
          ["▼", "ArrowDown"],
          ["▶", "ArrowRight"],
        ] as [string, string][]).map(([label, key]) => (
          <button
            key={key}
            type="button"
            aria-label={`${label} key`}
            className="h-10 w-12 rounded-md border border-line bg-[#fbf6ea] text-base font-bold text-[#3a3f44] select-none active:bg-[#e8c84a]"
            onPointerDown={(e) => {
              e.preventDefault();
              keys.current.add(key);
              start();
            }}
            onPointerUp={() => keys.current.delete(key)}
            onPointerLeave={() => keys.current.delete(key)}
            onBlur={() => keys.current.delete(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <HighScores game="gta-browser" limit={5} title="Best cruises, everyone" />
    </Stack>
  );
}