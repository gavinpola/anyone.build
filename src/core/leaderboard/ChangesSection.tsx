import { useMutation } from "convex/react";
import { ShareButton, shareUrl } from "@/core/share/ShareButton";
import { ArrowBigUp, GitPullRequest } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { hasConvex, useQuerySafe } from "@/core/lib/providers";
import { timeAgo } from "@/core/lib/useNow";
import { useViewer } from "@/core/auth/useViewer";
import { cn } from "@/core/lib/cn";
import { LEDGER_ROWS, ScrollHint, WhoAsked } from "./Ledger";

export function ChangesSection() {
  const rows = useQuerySafe(api.votes.recentChanges, hasConvex ? { limit: 50 } : "skip");
  const toggle = useMutation(api.votes.toggle);
  const viewer = useViewer();
  return (
    <section>
      <h2 className="font-display text-2xl">Changes</h2>
      <div className="frame mt-3 overflow-hidden">
        {rows && rows.length ? (
          <ul className="ledger-scroll" data-ledger="changes">
            {rows.map((c) => (
              <li key={c.id} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
                <button
                  type="button"
                  disabled={c.mine}
                  onClick={() => (viewer.signedIn ? void toggle({ changeId: c.id }).catch(() => {}) : viewer.signIn())}
                  className={cn(
                    "flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md border text-[12px] tabular-nums transition",
                    c.myVote ? "border-accent bg-accent-soft text-accent" : "border-line bg-card text-ink-2 hover:border-line-2",
                    c.mine && "opacity-50",
                  )}
                  aria-pressed={c.myVote}
                  title={c.mine ? "Your own change" : "Vote"}
                >
                  <ArrowBigUp size={16} />
                  {c.votes}
                </button>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px]">{c.summary || "A change on the wall."}</span>
                  <span className="placard flex items-center gap-2">
                    <WhoAsked by={c.by} /> · {timeAgo(c.mergedAt)} · {c.blockIds.join(", ") || "wall"} ·{" "}
                    <span className="text-ok">+{c.linesAdded}</span> <span className="text-bad">−{c.linesRemoved}</span>
                  </span>
                </span>
                  <ShareButton compact url={shareUrl("c", c.requestId)} title={c.summary || "A change on the wall"} text="Made on everyones.lol, the website anyone can change" />
                {c.prUrl && c.prUrl.startsWith("https://") ? (
                  <a href={c.prUrl} target="_blank" rel="noopener noreferrer" className="placard inline-flex items-center gap-1 hover:text-accent">
                    <GitPullRequest size={12} /> PR
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-5 text-[14px] text-muted">Nothing yet.</p>
        )}
        {rows && rows.length > LEDGER_ROWS ? <ScrollHint more={rows.length - LEDGER_ROWS} /> : null}
      </div>
    </section>
  );
}
