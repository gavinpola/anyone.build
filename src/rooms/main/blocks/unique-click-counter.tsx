import { useState } from "react";
import { Button, Row, Stack, Text, useCounter } from "@/kit";
import type { BlockMeta } from "@/kit";

export const block: BlockMeta = {
  id: "unique-click-counter",
  title: "Unique clicker",
  description: "A button for the whole wall — each unique person gets one click counted.",
  order: 6,
  size: "md",
  place: { x: 900, y: 520, w: 560 },
};

export default function UniqueClickCounter() {
  // One shared counter for the whole wall; the count = unique people, since the backend
  // records each visitor (account or browser tab) once.
  const { value, bump } = useCounter("unique-click-counter");
  // "counted" is local to this viewer so a single person can't rack up the number twice.
  const [counted, setCounted] = useState(false);

  const onPush = () => {
    if (counted) return;
    setCounted(true);
    bump();
  };

  return (
    <Stack className="p-5 sm:p-6" gap={3}>
      <Stack gap={1} className="max-w-2xl">
        <Text>Push the button. It counts how many unique people have pushed it — one click per person.</Text>
      </Stack>
      <Row gap={4} className="items-center">
        <Button size="lg" onClick={onPush} disabled={counted} className="min-w-[150px]">
          {counted ? "You're counted ✓" : "Push me"}
        </Button>
        <Stack gap={1}>
          <Text className="font-display text-4xl leading-none tabular-nums text-ink">{value}</Text>
          <Text muted className="text-[12px] leading-none">
            unique people
          </Text>
        </Stack>
      </Row>
    </Stack>
  );
}