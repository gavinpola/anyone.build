import type { BlockMeta } from "@/kit";

export const block: BlockMeta = {
  id: "hello-note-6e0z",
  title: "Hello Note",
  description: "A tiny hello note 6e0z at the bottom of the wall.",
  order: 2,
  size: "sm",
  removed: true, // taken off the wall (asked for in #15); the file stays so "bring it back" is one flip
};

export default function HelloNote6e0z() {
  return null;
}