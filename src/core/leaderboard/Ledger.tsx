import type { ReactNode } from "react";
import { ArrowBigUp } from "lucide-react";
import { Avatar } from "@/core/feed/RequestCard";
import { cn } from "@/core/lib/cn";

/** A ledger shows five rows; the rest are there when you scroll. */
export const LEDGER_ROWS = 5;

export function ScrollHint({ more }: { more: number }) {
  return (
    <p className="ledger-hint placard border-t border-line px-4 py-2" data-ledger-more={more}>
      scroll for {more} more
    </p>
  );
}

/** Who asked: the handle links to their GitHub when they signed in with it; guests stay guests. */
export function WhoAsked({ by }: { by: { handle: string; github: string | null; avatarUrl: string | null; guest: boolean } }) {
  if (by.guest) return <span>{by.handle}</span>;
  const inner = (
    <>
      <Avatar handle={by.handle} url={by.avatarUrl} size={14} />@{by.handle}
    </>
  );
  return by.github ? (
    <a href={by.github} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-accent" data-github={by.handle}>
      {inner}
    </a>
  ) : (
    <span className="inline-flex items-center gap-1">{inner}</span>
  );
}

/**
 * A ledger: one frame, rows in a scroll, "Nothing yet." when empty, "Loading…" before the first answer, and
 * the scroll hint past five rows. Changes, feedback, and anything else that lists what people did share it,
 * so an empty board reads the same everywhere.
 */
export function Ledger<T>({ name, rows, empty = "Nothing yet.", children }: { name: string; rows: T[] | undefined | null; empty?: string; children: (row: T) => ReactNode }) {
  return (
    <div className="frame mt-3 overflow-hidden">
      {rows == null ? (
        <p className="p-5 text-[14px] text-muted">Loading…</p>
      ) : rows.length ? (
        <ul className="ledger-scroll" data-ledger={name}>
          {rows.map(children)}
        </ul>
      ) : (
        <p className="p-5 text-[14px] text-muted">{empty}</p>
      )}
      {rows && rows.length > LEDGER_ROWS ? <ScrollHint more={rows.length - LEDGER_ROWS} /> : null}
    </div>
  );
}

/** The vote square at the left of a ledger row: the arrow, the count, orange when it's yours. */
export function VoteButton({ votes, pressed, disabled, dimmed, title, onClick }: { votes: number; pressed: boolean; disabled?: boolean; dimmed?: boolean; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md border text-[12px] tabular-nums transition disabled:opacity-60",
        pressed ? "border-accent bg-accent-soft text-accent" : "border-line bg-card text-ink-2 hover:border-line-2",
        dimmed && "opacity-50",
      )}
      aria-pressed={pressed}
      title={title}
    >
      <ArrowBigUp size={16} />
      {votes}
    </button>
  );
}
