import { Stack, Text } from "@/kit";
import type { BlockMeta } from "@/kit";

export const block: BlockMeta = {
  id: "say-hi-ella",
  title: "Say hi Ella",
  description: "A little hello for Ella on the wall.",
  order: 3,
  size: "sm",
  shape: "bare",
  place: { x: 0, y: 3 },
};

export default function SayHiElla() {
  return (
    <Stack className="p-4" gap={1}>
      <Text className="text-lg font-semibold">Say hi Ella!!</Text>
    </Stack>
  );
}