import { Heading, Label, Stack, Text } from "@/kit";
import type { BlockMeta } from "@/kit";

export const block: BlockMeta = {
  id: "house-rules",
  title: "House rules",
  description: "The short version of what the judge will and won't let through.",
  order: 40,
  size: "md",
};

const rules = [
  ["Make it better for everyone.", "Not just for you."],
  ["Build on, don't bulldoze.", "Erasing someone's work needs a reason."],
  ["No ads, no promo, no links out.", "Patrons pay for that, on their own board."],
  ["Nothing hidden.", "Do what you asked for and only that."],
  ["Works on a phone.", "If it breaks the wall, it doesn't ship."],
];

export default function HouseRules() {
  return (
    <Stack className="p-5" gap={3}>
      <Label>House rules</Label>
      <Heading level={2}>What gets through</Heading>
      <ol className="flex flex-col gap-2">
        {rules.map(([a, b], i) => (
          <li key={a} className="flex gap-3 border-t border-line pt-2 first:border-t-0 first:pt-0">
            <span className="placard w-5 shrink-0 pt-1">{String(i + 1).padStart(2, "0")}</span>
            <span>
              <span className="text-ink">{a}</span> <Text muted className="inline text-[14px]">{b}</Text>
            </span>
          </li>
        ))}
      </ol>
    </Stack>
  );
}
