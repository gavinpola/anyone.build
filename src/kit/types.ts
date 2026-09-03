/** Metadata every block exports as `block`. */
export type BlockMeta = {
  /** Stable id, kebab-case, unique within the room. Never change it once live. */
  id: string;
  /** Shown on the placard under the frame. */
  title: string;
  /** One line, shown to the judge and in the manifest. */
  description: string;
  /** Lower comes first. Ties broken by id. */
  order: number;
  /** Width on the 12-column wall. */
  size: "sm" | "md" | "lg" | "full";
};

export type BlockModule = {
  default: React.ComponentType;
  block: BlockMeta;
};
