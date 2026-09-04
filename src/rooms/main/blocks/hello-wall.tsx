import { useRef, useState } from "react";
import { Button, Row, Stack, Text, useTick } from "@/kit";
import type { BlockMeta } from "@/kit";

export const block: BlockMeta = {
  id: "hello-wall",
  title: "Hello",
  description: "The head of the wall is a game now — tap the brick as fast as you can.",
  order: 0,
  size: "lg",
  shape: "soft",
  tilt: 0.4,
};

const GAME_SECONDS = 15;
const randIn = (min: number, max: number) => min + Math.random() * (max - min);

export default function HelloWall() {
  const [phase, setPhase] = useState<"idle" | "playing" | "done">("idle");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);
  const [target, setTarget] = useState({ x: 50, y: 40 });

  const timeRef = useRef(GAME_SECONDS);

  useTick(
    (dt) => {
      if (phase !== "playing") return;
      timeRef.current -= dt;
      setTimeLeft(Math.max(0, Math.ceil(timeRef.current)));
      if (timeRef.current <= 0) {
        setPhase("done");
        setBest((b) => Math.max(b, score));
      }
    },
    { fps: 30, active: phase === "playing" },
  );

  const start = () => {
    timeRef.current = GAME_SECONDS;
    setTimeLeft(GAME_SECONDS);
    setScore(0);
    setTarget({ x: randIn(10, 76), y: randIn(14, 60) });
    setPhase("playing");
  };

  const hit = () => {
    setScore((s) => s + 1);
    setTarget({ x: randIn(10, 76), y: randIn(14, 60) });
  };

  const copy =
    phase === "idle"
      ? "Hello, welcome to the wall! It's a game now: tap the glowing brick as many times as you can in 15 seconds."
      : phase === "playing"
        ? "Keep tapping — the brick hops after every hit."
        : `Time's up. You tapped ${score} brick${score === 1 ? "" : "s"}${score > 0 ? ` — that${score === 1 ? " is" : "'s"} your best this visit.` : ". Try again?"}`;

  return (
    <Stack className="p-5 sm:p-6" gap={3}>
      <Stack gap={1}>
        <Text className="placard smallcaps text-muted">hello, welcome to the wall</Text>
        <Text className="max-w-2xl">{copy}</Text>
      </Stack>

      <div className="relative h-60 w-full overflow-hidden rounded-lg border border-line bg-gradient-to-br from-paper-2 to-paper sm:h-80">
        {phase === "playing" && (
          <Button
            variant="primary"
            size="lg"
            className="absolute h-14 w-14 rounded-full p-0 text-base shadow-[0_0_20px_rgba(244,63,94,0.6)]"
            style={{ left: `${target.x}%`, top: `${target.y}%`, transform: "translate(-50%, -50%)" }}
            onPointerDown={hit}
            aria-label="tap the brick"
          >
            tap
          </Button>
        )}
        {phase !== "playing" && (
          <Stack className="h-full items-center justify-center gap-3" gap={3}>
            <Text muted>
              {phase === "idle"
                ? "One brick, fifteen seconds, as many taps as you can."
                : `Bricks tapped: ${score}`}
            </Text>
            <Button variant="primary" size="lg" onClick={start}>
              {phase === "idle" ? "Start the game" : "Play again"}
            </Button>
          </Stack>
        )}
      </div>

      <Row gap={4} className="text-[13px]">
        <Text>Score: <span className="font-semibold text-ink">{score}</span></Text>
        <Text>Time left: <span className="font-semibold text-ink">{timeLeft}s</span></Text>
        <Text muted>Best this visit: {best}</Text>
      </Row>
    </Stack>
  );
}