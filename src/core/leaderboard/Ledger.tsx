import { Avatar } from "@/core/feed/RequestCard";

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
