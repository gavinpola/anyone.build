import { Stack, Text } from "@/kit";
import type { BlockMeta } from "@/kit";

export const block: BlockMeta = {
  id: "hello-note-6e0z",
  title: "Hello Note",
  description: "A tiny hello note 6e0z at the bottom of the wall.",
  order: 2,
  size: "sm",
  shape: "bare",
  tilt: -1.3,
};

export default function HelloNote6e0z() {
  return (
    <Stack className="p-5 sm:p-6" gap={2}>
      <Text className="max-w-2xl">hello note 6e0z</Text>
    </Stack>
  );
}