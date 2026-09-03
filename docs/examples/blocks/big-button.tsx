import { Button, Label, Stack, useCounter } from "@/kit";
import type { BlockMeta } from "@/kit";

export const block: BlockMeta = {
  id: "big-button",
  title: "The Button",
  description: "A big button that counts how many times everyone, everywhere, has pressed it.",
  order: 10,
  size: "sm",
};

export default function BigButton() {
  const { value, bump } = useCounter("big-button");
  return (
    <Stack className="items-center p-6 text-center" gap={4}>
      <Label>Pressed by everyone</Label>
      <div className="font-serif text-6xl tabular-nums">{value.toLocaleString()}</div>
      <Button variant="primary" size="lg" onClick={() => bump()} className="w-full">
        Press it
      </Button>
    </Stack>
  );
}
