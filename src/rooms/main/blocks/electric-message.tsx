import { Stack, Text } from "@/kit";
import type { BlockMeta } from "@/kit";
import { motion } from "motion/react";
import { Zap } from "lucide-react";

export const block: BlockMeta = {
  id: "electric-message",
  title: "Electric",
  description: "A short spark of a message on the wall.",
  order: 3,
  size: "full",
};

export default function ElectricMessage() {
  return (
    <Stack
      className="rounded-[11px] bg-gradient-to-br from-[#1b1712] via-[#0e0c09] to-[#050403] p-5 sm:p-6 [&_p]:text-[#f4efe3]"
      gap={2}
    >
      <Text className="max-w-2xl">
        Well this is{" "}
        <motion.span
          className="inline-flex translate-y-[2px] text-[#ffd84d]"
          animate={{
            filter: [
              "drop-shadow(0 0 5px rgba(255,216,77,0.45))",
              "drop-shadow(0 0 14px rgba(255,216,77,0.9))",
              "drop-shadow(0 0 5px rgba(255,216,77,0.45))",
            ],
          }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        >
          <Zap size={22} strokeWidth={2.4} className="fill-current" />
        </motion.span>
        .
      </Text>
    </Stack>
  );
}