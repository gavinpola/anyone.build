import { Button, Label, Stack, Text, useStore, useViewer } from "@/kit";
import type { BlockMeta } from "@/kit";

export const block: BlockMeta = {
  id: "poll",
  title: "Poll",
  description: "One question, a few options, everyone's votes. Change the question if you dare.",
  order: 30,
  size: "sm",
};

const QUESTION = "What should this wall become?";
const OPTIONS = ["A game", "A zine", "A tool", "Chaos"];

export default function Poll() {
  const viewer = useViewer();
  const { docs, put } = useStore<string>("poll:v1");
  const mine = docs.find((d) => d.key === viewer.handle)?.value ?? null;
  const counts = OPTIONS.map((o) => docs.filter((d) => d.value === o).length);
  const total = counts.reduce((a, b) => a + b, 0);

  return (
    <Stack className="p-5" gap={3}>
      <Label>Poll · {total} {total === 1 ? "vote" : "votes"}</Label>
      <Text className="font-serif text-xl text-ink">{QUESTION}</Text>
      <Stack gap={2}>
        {OPTIONS.map((o, i) => {
          const pct = total ? Math.round((100 * (counts[i] ?? 0)) / total) : 0;
          return (
            <Button
              key={o}
              variant={mine === o ? "primary" : "secondary"}
              className="relative justify-between overflow-hidden"
              onClick={() => put(viewer.handle, o)}
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 bg-accent-soft"
                style={{ width: `${pct}%`, opacity: mine === o ? 0 : 1 }}
              />
              <span className="relative">{o}</span>
              <span className="relative placard">{pct}%</span>
            </Button>
          );
        })}
      </Stack>
    </Stack>
  );
}
