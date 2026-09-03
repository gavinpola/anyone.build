import { Stack, Text } from "@/kit";
import type { BlockMeta } from "@/kit";

export const block: BlockMeta = {
  id: "electric-message",
  title: "Electric",
  description: "A short spark of a message on the wall.",
  order: 3,
  size: "full",
};

export default function ElectricMessage() {
  return (
    <Stack className="p-5 sm:p-6" gap={2}>
      <Text className="max-w-2xl">Well this is electric.</Text>
    </Stack>
  );
}