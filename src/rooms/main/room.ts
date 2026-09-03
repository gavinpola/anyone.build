/**
 * The main room's manifest. Agent-editable, but only these fields.
 * Blocks live in ./blocks — one file each, auto-discovered.
 */
export const room = {
  id: "main",
  title: "The Wall",
  description: "The first room. Anything goes, as long as it's good for everyone.",
} as const;
