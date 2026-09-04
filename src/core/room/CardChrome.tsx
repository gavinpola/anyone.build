import { cn } from "@/core/lib/cn";

const leftText = (ms: number | null) => (ms == null ? "∞" : ms <= 0 ? "faded" : ms < 3_600_000 ? `${Math.max(1, Math.round(ms / 60_000))}m left` : ms < 86_400_000 ? `${Math.round(ms / 3_600_000)}h left` : `${Math.round(ms / 86_400_000)}d left`);

/**
 * The mono bar on top of a block: who made it, what it is, how long it has. Outside the block's body, so
 * the picker ignores it and dragging it moves the block.
 */
export function CardChrome({ by, title, left, pinned, isNew, editing, faded }: { by: string | null; title: string; left: number | null; pinned?: boolean; isNew?: boolean; editing?: boolean; faded?: boolean }) {
  const status = editing ? "editing" : faded ? "touch to revive" : isNew ? "just landed" : pinned ? "pinned · ∞" : leftText(left);
  return (
    <div className={cn("object-label", editing && "is-editing", isNew && "is-new", faded && "is-faded", left != null && left > 0 && left < 86_400_000 && "is-dying")} aria-hidden title="Drag to move">
      <span className="truncate">
        {by ? `@${by}` : "the wall"}
        <span className="opacity-50"> · </span>
        {title}
      </span>
      <span className="object-status">{status}</span>
    </div>
  );
}
