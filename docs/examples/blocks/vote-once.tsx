import { useState } from "react";
import { Button, Heading, Row, Stack, Text, useRoomMutation, useRoomQuery, useViewer, type BlockMeta } from "@/kit";

/** Example (dev/e2e only): a block backed by the room's own function, convex/rooms/main/poll.ts. */
export const block: BlockMeta = {
  id: "vote-once",
  title: "Vote once",
  description: "Which color should the wall lean toward? One vote per person, kept by a room function.",
  order: 90,
  size: "md",
};

const CHOICES = ["warm", "cool", "neither"];

export default function VoteOnce() {
  const viewer = useViewer();
  const results = useRoomQuery<{ tally: Record<string, number>; total: number; mine: string | null }>("poll:results", { poll: "color" });
  const vote = useRoomMutation("poll:vote");
  const [error, setError] = useState<string | null>(null);
  return (
    <Stack className="p-5" gap={3}>
      <Heading level={2}>Warm or cool?</Heading>
      <Row className="flex-wrap gap-2">
        {CHOICES.map((c) => (
          <Button
            key={c}
            variant={results?.mine === c ? "primary" : "secondary"}
            onClick={() => {
              setError(null);
              vote({ poll: "color", choice: c }).catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't vote"));
            }}
          >
            {c} · {results?.tally[c] ?? 0}
          </Button>
        ))}
      </Row>
      <Text className="text-[13px] text-muted">
        {results ? `${results.total} ${results.total === 1 ? "vote" : "votes"}` : "…"}
        {!viewer.signedIn ? " · sign in to vote" : ""}
      </Text>
      {error ? (
        <Text role="alert" className="text-[13px] text-bad">
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}
