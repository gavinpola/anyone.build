import { Heading, Text, Label, Stack, useRoomPresence } from "@/kit";
import type { BlockMeta } from "@/kit";

export const block: BlockMeta = {
  id: "welcome",
  title: "Welcome",
  description: "The opening wall text. Explains what this place is in three sentences.",
  order: 0,
  size: "full",
};

export default function Welcome() {
  const { count } = useRoomPresence();
  return (
    <Stack className="p-6 sm:p-8" gap={3}>
      <Label>Wall text</Label>
      <Heading level={1}>
        This is the website <em className="text-accent not-italic">anyone</em> can change.
      </Heading>
      <Text className="max-w-2xl text-[17px]">
        Hold shift and command, point at anything on this wall, and say what should change.
        If it makes the room better for everyone, an agent writes the code, opens a pull request,
        and it ships. If it doesn't, it doesn't. Every change is a commit with your name on it.
      </Text>
      <Text muted className="text-[13px]">
        {count === 1 ? "You are the only one here right now." : `${count} people are in the room right now.`}
      </Text>
    </Stack>
  );
}
