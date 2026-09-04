import { useState } from "react";
import { cn } from "@/core/lib/cn";
import { useNow, timeAgo } from "@/core/lib/useNow";
import { PageLink } from "@/kit/PageLink";

export type DirectoryItem = {
  id: string;
  title: string;
  by: string | null;
  lastAt: number | null;
  changes: number;
  /** ms left before it fades, or null when it never fades */
  left: number | null;
  window: number;
  editing: boolean;
  faded: boolean;
  isNew: boolean;
};

const initials = (s: string | null) => (s ? s.replace(/^guest[- ·]*/i, "g").slice(0, 2).toUpperCase() : "··");
const leftText = (ms: number | null) => (ms == null ? "∞" : ms <= 0 ? "gone" : ms < 3_600_000 ? `${Math.max(1, Math.round(ms / 60_000))}m` : ms < 86_400_000 ? `${Math.round(ms / 3_600_000)}h` : `${Math.round(ms / 86_400_000)}d`);

/** What's on the canvas: a directory, not a layers panel. Click to go there. */
export function Directory({ items, decayOn, onGo, className, pages = [], compact = false }: { items: DirectoryItem[]; decayOn: boolean; onGo: (id: string) => void; className?: string; pages?: Array<{ slug: string; title: string }>; compact?: boolean }) {
  const [tab, setTab] = useState<"hot" | "new" | "dying">("hot");
  const now = useNow(30_000);
  if (compact) {
    // phones: a strip of chips above the canvas; tap to go there
    const list = [...items].sort((a, b) => b.changes - a.changes || (b.lastAt ?? 0) - (a.lastAt ?? 0));
    return (
      <div className={cn("directory-strip", className)} aria-label="On the canvas" data-directory={items.length}>
        <span className="placard smallcaps shrink-0">on the canvas</span>
        {pages.map((p) => (
          <PageLink key={p.slug} to={p.slug} className="directory-chip">
            {p.title}
          </PageLink>
        ))}
        {list.map((it) => (
          <button key={it.id} type="button" onClick={() => onGo(it.id)} className={cn("directory-chip", it.editing && "is-editing", it.faded && "is-faded")} data-directory-item={it.id}>
            <span className={cn("directory-chip-dot", it.isNew ? "bg-ok" : it.left != null && it.left < 86_400_000 ? "bg-warn" : "bg-line-2")} />
            {it.title}
          </button>
        ))}
      </div>
    );
  }
  const sorted = [...items].sort((a, b) =>
    tab === "hot" ? b.changes - a.changes || (b.lastAt ?? 0) - (a.lastAt ?? 0) : tab === "new" ? (b.lastAt ?? 0) - (a.lastAt ?? 0) : (a.left ?? Infinity) - (b.left ?? Infinity),
  );
  return (
    <aside className={cn("directory", className)} aria-label="On the canvas" data-directory={items.length}>
      <div className="flex items-baseline justify-between px-4 pt-4">
        <span className="placard smallcaps">on the canvas</span>
        <span className="placard text-accent tabular-nums">{items.length}</span>
      </div>
      <div className="mt-2 flex gap-1 px-4">
        {(["hot", "new", "dying"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={cn("directory-tab", tab === t && "is-on")} aria-pressed={tab === t}>
            {t}
          </button>
        ))}
      </div>
      {pages.length ? (
        <nav aria-label="Pages" className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line px-4 pt-3">
          <span className="placard smallcaps">pages</span>
          {pages.map((p) => (
            <PageLink key={p.slug} to={p.slug} className="rounded-md border border-line px-2 py-0.5 text-[12px] hover:bg-paper-2">
              {p.title}
            </PageLink>
          ))}
        </nav>
      ) : null}
      <ol className="mt-2 flex-1 overflow-y-auto">
        {sorted.map((it) => {
          const frac = it.left == null ? 1 : Math.max(0, Math.min(1, it.left / it.window));
          return (
            <li key={it.id}>
              <button type="button" onClick={() => onGo(it.id)} className={cn("directory-row", it.editing && "is-editing", it.faded && "is-faded")} data-directory-item={it.id}>
                <span className="directory-avatar">{initials(it.by)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-medium">{it.title}</span>
                    <span className={cn("placard shrink-0", it.isNew && "text-ok", it.editing && "text-accent")}>{it.editing ? "editing" : it.isNew ? "new" : it.left == null ? "pinned" : leftText(it.left)}</span>
                  </span>
                  <span className="mt-1 block h-[3px] rounded-full bg-line">
                    <span className={cn("block h-full rounded-full", frac < 0.15 ? "bg-bad" : frac < 0.4 ? "bg-warn" : "bg-accent")} style={{ width: `${Math.round(frac * 100)}%` }} />
                  </span>
                  <span className="placard mt-0.5 block truncate">
                    {it.by ? `@${it.by}` : "the wall"}
                    {it.lastAt ? ` · ${timeAgo(it.lastAt, now)}` : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {items.length === 0 ? <li className="px-4 py-3 text-[13px] text-muted">Nothing here yet.</li> : null}
      </ol>
      <div className="border-t border-line px-4 py-3">
        <span className="placard smallcaps">{decayOn ? "decay is on" : "decay is off"}</span>
        <p className="mt-1 text-[12px] leading-snug text-ink-2">{decayOn ? "Everything fades unless it's touched. Play it, move it, change it: the clock resets." : "Nothing fades. Set decay in the wall's own file to change that."}</p>
      </div>
    </aside>
  );
}
