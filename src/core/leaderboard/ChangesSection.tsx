import { useMutation } from "convex/react";
import { ShareButton, shareUrl } from "@/core/share/ShareButton";
import { GitPullRequest } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { hasConvex, useQuerySafe } from "@/core/lib/providers";
import { timeAgo } from "@/core/lib/useNow";
import { useViewer } from "@/core/auth/useViewer";
import { Ledger, VoteButton, WhoAsked } from "./Ledger";
import { formatCents } from "@/core/lib/money";
import { FeedbackBoard } from "@/core/feedback/Feedback";

export function ChangesSection() {
  const rows = useQuerySafe(api.votes.recentChanges, hasConvex ? { limit: 50 } : "skip");
  const toggle = useMutation(api.votes.toggle);
  const viewer = useViewer();
  return (
    <section>
      <h2 className="font-display text-2xl">Changes</h2>
      <Ledger name="changes" rows={rows}>
        {(c) => (
          <li key={c.id} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
            <VoteButton votes={c.votes} pressed={c.myVote} disabled={c.mine} dimmed={c.mine} title={c.mine ? "Your own change" : "Vote"} onClick={() => (viewer.signedIn ? void toggle({ changeId: c.id }).catch(() => {}) : viewer.signIn())} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px]">{c.summary || "A change on the wall."}</span>
              <span className="placard flex items-center gap-2">
                <WhoAsked by={c.by} /> · {timeAgo(c.mergedAt)} · {c.blockIds.join(", ") || "wall"} ·{" "}
                <span className="text-ok">+{c.linesAdded}</span> <span className="text-bad">−{c.linesRemoved}</span>
                {formatCents(c.costCents) ? (
                  <>
                    {" "}·{" "}
                    <span className="tabular-nums" title="what it cost to build" data-cost>
                      {formatCents(c.costCents)}
                    </span>
                  </>
                ) : null}
              </span>
            </span>
            <ShareButton compact url={shareUrl("c", c.requestId)} title={c.summary || "A change on the wall"} text="Made on everyones.lol, the website anyone can change" />
            {c.prUrl && c.prUrl.startsWith("https://") ? (
              <a href={c.prUrl} target="_blank" rel="noopener noreferrer" className="placard inline-flex items-center gap-1 hover:text-accent">
                <GitPullRequest size={12} /> PR
              </a>
            ) : null}
          </li>
        )}
      </Ledger>
      {/* the frame around the wall: what people said is off about the site itself, and the votes on it */}
      <div id="feedback" className="mt-8 scroll-mt-20" data-feedback-section>
        <h2 className="font-display text-2xl">Feedback on the site</h2>
        <FeedbackBoard />
      </div>
    </section>
  );
}
