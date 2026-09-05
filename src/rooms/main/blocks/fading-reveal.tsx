import { useState } from "react";
import { Stack, Text } from "@/kit";
import type { BlockMeta } from "@/kit";

export const block: BlockMeta = {
  id: "fading-reveal",
  title: "Fading reveal",
  description: "A foggy lid — click it and it melts away to show what's hiding underneath.",
  order: 4,
  size: "md",
  shape: "soft",
};

export default function FadingReveal() {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="relative h-48 w-full overflow-hidden rounded-[11px]">
      {/* the secret underneath, visible once the fog lifts */}
      <Stack className="h-full items-center justify-center gap-1" gap={1}>
        <Text className="text-2xl font-bold">look at me!</Text>
        <Text muted className="text-sm">
          you found me
        </Text>
      </Stack>

      {/* the fog: a semi-transparent cover over the whole block; a click fades it out in one second */}
      <div
        role="button"
        tabIndex={0}
        aria-label="tap to fade the fog away"
        onClick={() => setRevealed(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setRevealed(true);
          }
        }}
        className={`absolute inset-0 flex cursor-pointer select-none items-center justify-center text-[#f4efe3] transition-opacity duration-1000 ease-out ${
          revealed ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
        style={{ background: "rgba(14, 12, 9, 0.72)" }}
      >
        <Stack className="items-center gap-1" gap={1}>
          <Text className="text-lg font-semibold text-[#f4efe3]">tap anywhere</Text>
          <Text className="text-sm text-[#f4efe3]/70">this fog fades away</Text>
        </Stack>
      </div>
    </div>
  );
}