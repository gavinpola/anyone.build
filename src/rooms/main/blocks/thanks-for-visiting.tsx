import { Stack, Text } from "@/kit";
import type { BlockMeta } from "@/kit";

export const block: BlockMeta = {
  id: "thanks-for-visiting",
  title: "Thanks for visiting",
  description: "A small note thanking anyone who stops by the wall.",
  order: 2,
  size: "md",
};

export default function ThanksForVisiting() {
  return (
    <Stack className="p-5 sm:p-6" gap={2}>
      <Text className="max-w-2xl">Thanks to everyone who changed something on the wall this week — you're the reason it's alive.</Text>
    </Stack>
  );
}
