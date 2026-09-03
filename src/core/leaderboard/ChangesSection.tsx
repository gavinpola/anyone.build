import { useMutation, useQuery } from "convex/react";
import { ArrowBigUp, GitPullRequest } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { hasConvex } from "@/core/lib/providers";
import { Avatar } from "@/core/feed/RequestCard";
import { timeAgo } from "@/core/lib/useNow";
import { useViewer } from "@/core/auth/useViewer";
import { cn } from "@/core/lib/cn";

export function ChangesSection() {
  const rows = useQuery(api.votes.recentChanges, hasConvex ? { limit: 50 } : "skip");
  const toggle = useMutation(api.votes.toggle);
  const viewer = useViewer();
  return (
    <section>
      <h2 className="font-display text-2xl">Changes</h2>
      <div className="frame mt-3 overflow-hidden">
        {rows && rows.length ? (
          <ul>
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
                    <Avatar handle={c.by.handle} url={c.by.avatarUrl} size={16} />
                    @{c.by.handle} · {timeAgo(c.mergedAt)} · {c.blockIds.join(", ") || "wall"} ·{" "}
                    <span className="text-ok">+{c.linesAdded}</span> <span className="text-bad">−{c.linesRemoved}</span>
                  </span>
                </span>
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
      </div>
    </section>
  );
}
