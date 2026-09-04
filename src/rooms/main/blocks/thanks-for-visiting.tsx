import { Stack, Text } from "@/kit";
import type { BlockMeta } from "@/kit";

export const block: BlockMeta = {
  id: "thanks-for-visiting",
  title: "Thanks for visiting",
  description: "A small note thanking anyone who stops by the wall.",
  order: 2,
  size: "md",
  shape: "round",
  tilt: 0.8,
};

export default function ThanksForVisiting() {
  return (
    <Stack className="p-5 sm:p-6" gap={2}>
      <Text className="max-w-2xl">where the people at?i love you all!!</Text>
    </Stack>
  );
}
