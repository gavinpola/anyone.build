/**
 * The block kit — everything a block in src/rooms/** is allowed to use.
 * Rooms may import from: "react", "@/kit", "motion/react", "lucide-react", and relative files.
 */
export type { BlockMeta, BlockModule, PageMeta, PageModule, CanvasMeta, ShapePreset, CustomShape } from "./types";
export { Stack, Row, Heading, Text, Label, Card, Button, Input, Textarea, Divider } from "./ui";
export { SafeLink, resolveSafeHref, LINK_ALLOWLIST } from "./SafeLink";
export { PageLink } from "./PageLink";
export { useRoomId } from "./room-context";
export { useRoomQuery, useRoomMutation } from "./room";
export { useViewer, useStore, useCounter, useRoomPresence, useNow, useTick, useHighScores, type HighScore } from "./hooks";
export { HighScores } from "./HighScores";
export { cn } from "@/core/lib/cn";
