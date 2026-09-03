import { Heading, Stack, Text } from "@/kit";
import type { BlockMeta } from "@/kit";

export const block: BlockMeta = {
  id: "hello-wall",
  title: "Hello",
  description: "A short hello line at the head of the wall for whoever shows up.",
  order: 0,
  size: "full",
};

export default function HelloWall() {
  return (
    <Stack className="p-5 sm:p-6" gap={2}>
      <Heading level={1}>Hello, welcome to the wall!</Heading>
      <Text className="max-w-2xl">A short hello line at the head of the wall for whoever shows up. Glad you made it.</Text>
    </Stack>
  );
}