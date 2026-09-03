/**
 * The block kit — everything a block in src/rooms/** is allowed to use.
 * Rooms may import from: "react", "@/kit", "motion/react", "lucide-react", and relative files.
 */
export type { BlockMeta, BlockModule } from "./types";
export { Stack, Row, Heading, Text, Label, Card, Button, Input, Textarea, Divider } from "./ui";
export { SafeLink, resolveSafeHref, LINK_ALLOWLIST } from "./SafeLink";
export { useViewer, useStore, useCounter, useRoomPresence, useNow } from "./hooks";
export { cn } from "@/core/lib/cn";
