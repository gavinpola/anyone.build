import { Stack, Text } from "@/kit";
import type { BlockMeta } from "@/kit";
import { motion } from "motion/react";

export const block: BlockMeta = {
  id: "andre-signature",
  title: "Andre's signature",
  description: "A guestbook line — 'I was here...' — with Andre's signature writing itself.",
  order: 8,
  size: "md",
  shape: "soft",
  place: { x: -1, y: -3 },
};

// One continuous pen stroke spelling "Andre" in cursive on a 340x120 canvas (baseline y=105,
// x-height y=48, ascender y=22). A single stroke keeps the writing animation one smooth pen run.
const SIGNATURE_PATH =
  "M 22 102 C 28 74 36 48 46 26 C 54 48 62 74 70 102 C 64 92 54 86 42 84 C 48 84 54 84 60 84 " +
  "C 66 90 74 98 84 100 C 88 74 90 58 92 48 C 94 74 97 88 100 102 C 104 74 107 58 110 48 C 113 74 116 88 120 102 C 124 98 127 96 130 98 " +
  "C 134 74 143 42 152 22 C 156 48 160 74 164 102 C 165 80 166 70 168 62 C 172 74 176 88 180 102 C 182 92 183 86 184 80 " +
  "C 188 64 198 55 208 46 C 212 54 215 60 218 66 C 222 58 224 54 226 50 " +
  "C 232 62 244 78 256 102 C 259 82 261 72 264 62 C 267 72 270 86 274 102 C 282 104 294 98 306 92 C 312 86 316 82 320 78";

export default function AndreSignature() {
  return (
    <Stack className="items-center p-5 sm:p-6" gap={2}>
      <Text muted className="italic">
        I was here...
      </Text>
      <svg
        viewBox="0 0 340 120"
        className="block w-full"
        role="img"
        aria-label="Andre's signature, writing itself"
      >
        <motion.path
          d={SIGNATURE_PATH}
          fill="none"
          stroke="#1b1712"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 1 }}
          animate={{ pathLength: [0, 1, 1, 0], opacity: [1, 1, 1, 0] }}
          transition={{ duration: 8, times: [0, 0.35, 0.9, 1], repeat: Infinity, ease: "easeInOut" }}
        />
      </svg>
    </Stack>
  );
}