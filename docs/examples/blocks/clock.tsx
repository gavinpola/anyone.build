import { Label, Stack, useNow } from "@/kit";
import type { BlockMeta } from "@/kit";

export const block: BlockMeta = {
  id: "clock",
  title: "Clock",
  description: "The current time in UTC. Patron days roll over at midnight UTC.",
  order: 50,
  size: "sm",
};

export default function Clock() {
  const now = useNow(1000);
  const d = new Date(now);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  const untilMidnight = 24 * 3600 - (d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds());
  const h = Math.floor(untilMidnight / 3600);
  const m = Math.floor((untilMidnight % 3600) / 60);
  return (
    <Stack className="p-5" gap={2}>
      <Label>UTC</Label>
      <div className="font-serif text-5xl tabular-nums tracking-tight">
        {hh}:{mm}
        <span className="text-muted">:{ss}</span>
      </div>
      <span className="placard">
        {h}h {m}m until the patron board closes
      </span>
    </Stack>
  );
}
