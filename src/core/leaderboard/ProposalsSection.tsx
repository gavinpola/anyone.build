import { useMutation } from "convex/react";
import { ShareButton, shareUrl } from "@/core/share/ShareButton";
import { ArrowBigUp } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { hasConvex, useQuerySafe } from "@/core/lib/providers";
import { timeAgo } from "@/core/lib/useNow";
import { useViewer } from "@/core/auth/useViewer";
import { cn } from "@/core/lib/cn";
import { LEDGER_ROWS, ScrollHint, WhoAsked } from "./Ledger";
import { track } from "@/core/lib/analytics";
import { useNow } from "@/core/lib/useNow";
import { untilRoundEnd } from "../../../convex/lib/rounds";

/** "Up for a vote": safe-but-big asks the crowd decides on, in three-hour rounds: the top one is built, the rest start over. */
export function ProposalsSection() {
  const rows = useQuerySafe(api.proposals.list, hasConvex ? { limit: 100 } : "skip");
  const vote = useMutation(api.proposals.vote);
  const viewer = useViewer();
  const now = useNow(30_000);
  if (!hasConvex || (rows && rows.length === 0)) return null;
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl">Up for a vote</h2>
        <span className="placard" data-round-ends>round ends in {untilRoundEnd(now)}</span>
      </div>
      <p className="mt-1 text-[13px] text-ink-2">
        Bigger asks don't get turned away — they go here. Sign in to vote. Every three hours the most-wanted one is built, safely, and the rest start over.
      </p>
      <div className="frame mt-3 overflow-hidden">
        {rows ? (
          <ul className="ledger-scroll" data-ledger="proposals">
            {rows.map((p, i) => (
              <li key={p.id} data-proposal={p.id} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
                <button
                  type="button"
                  onClick={() => {
                    track("proposal_vote", { signedIn: viewer.signedIn });
                    return viewer.signedIn ? void vote({ requestId: p.id }).catch(() => {}) : viewer.signIn();
                  }}
                  className={cn(
                    "flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md border text-[12px] tabular-nums transition",
                    p.myVote ? "border-accent bg-accent-soft text-accent" : "border-line bg-card text-ink-2 hover:border-line-2",
                  )}
                  aria-pressed={p.myVote}
                  title={viewer.signedIn ? "Vote" : "Sign in to vote"}
                >
                  <ArrowBigUp size={16} />
                  {p.votes}
                </button>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{p.prompt}</span>
                  <span className="placard flex items-center gap-2">
                    {i === 0 && p.votes > 0 ? <span className="text-accent">leading</span> : null}
                    <WhoAsked by={p.by} />
                    <span>· {p.scope}</span>
                    <span>· {timeAgo(p.createdAt)}</span>
                  </span>
                </span>
                <ShareButton compact url={shareUrl("p", p.id)} title={p.prompt} text="Vote for this on everyones.lol" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-5 text-[14px] text-muted">Loading…</p>
        )}
        {rows && rows.length > LEDGER_ROWS ? <ScrollHint more={rows.length - LEDGER_ROWS} /> : null}
      </div>
    </section>
  );
}
