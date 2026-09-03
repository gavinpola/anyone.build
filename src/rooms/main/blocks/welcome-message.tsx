import { Stack, Text } from "@/kit";
import type { BlockMeta } from "@/kit";

export const block: BlockMeta = {
  id: "welcome-message",
  title: "Welcome",
  description: "A small line inviting everyone to add something to the wall.",
  order: 1,
  size: "full",
};

export default function WelcomeMessage() {
  return (
    <Stack className="p-5 sm:p-6" gap={2}>
      <Text className="max-w-2xl">The wall is open to everyone. Come here and add anything you want, really! Just have fun :)</Text>
    </Stack>
  );
}