import { useState } from "react";
import { useMutation } from "convex/react";
import { ArrowUpRight } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { hasConvex, useQuerySafe } from "@/core/lib/providers";
import { useViewer } from "@/core/auth/useViewer";
import { timeAgo } from "@/core/lib/useNow";
import { cn } from "@/core/lib/cn";
import { track } from "@/core/lib/analytics";
import { Ledger, VoteButton, WhoAsked } from "@/core/leaderboard/Ledger";

/** what a maintainer did with it: quiet, in the placard; only "shipped" gets a colour */
const STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: "open", cls: "" },
  approved: { label: "being built", cls: "text-ink" },
  done: { label: "shipped", cls: "text-ok" },
  declined: { label: "declined", cls: "" },
};

/**
 * Feedback on the site itself: the wall changes itself; the frame around it (the header, the map, the
 * composer, the pipeline) is ours, and this is how it changes. The form lives in the "?" card, so a note
 * is one step from wherever you are; the board (the votes, and what a maintainer did with them) lives
 * on the leaderboard under Changes.
 */
export function FeedbackForm({ compact = false }: { compact?: boolean }) {
  const viewer = useViewer();
  const submit = useMutation(api.feedback.submit);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const send = async () => {
    setError(null);
    try {
      await submit({ text });
      track("feedback_sent");
      setText("");
      setSent(true);
      setTimeout(() => setSent(false), 4000);
    } catch (e) {
      setError((e as Error).message.replace(/^.*Uncaught Error: /, "").split("\n")[0] ?? "That didn't send.");
    }
  };
  if (!hasConvex) return null;
  if (!viewer.signedIn) {
    return (
      <p className={compact ? "text-[12.5px] text-muted" : "text-[15px]"} data-feedback-form>
        Something off with the site itself?{" "}
        <button type="button" onClick={viewer.signIn} className="text-ink underline underline-offset-2 hover:text-accent">
          Sign in with GitHub
        </button>{" "}
        to say so and vote.
      </p>
    );
  }
  return (
    <div data-feedback-form>
      <label htmlFor="feedback-text" className={compact ? "text-[12.5px] text-muted" : "placard smallcaps"}>
        Something off with the site itself? Say it plainly
      </label>
      <textarea
        id="feedback-text"
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 600))}
        rows={compact ? 2 : 3}
        placeholder="The map covers the last row on my phone"
        className={cn("mt-1.5 w-full resize-none rounded-md border border-line bg-paper px-2.5 py-1.5 leading-relaxed text-ink outline-none placeholder:text-muted focus:border-line-2", compact ? "text-[13px]" : "text-[15px]")}
      />
      <div className="mt-1.5 flex items-center gap-2.5">
        <button type="button" onClick={send} disabled={text.trim().length < 8} className={cn("inline-flex items-center rounded-md bg-accent font-medium text-accent-ink hover:brightness-95 disabled:opacity-40", compact ? "h-7 px-3 text-[12.5px]" : "h-9 px-4 text-[13px]")}>
          Send
        </button>
        <span className="placard">{text.length}/600</span>
        {sent ? <span className="text-[12.5px] text-ok">On the board. Thank you.</span> : null}
        {error ? (
          <span role="alert" className="text-[12.5px] text-bad">
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** The board: every note, its votes, and what a maintainer did with it. Maintainers turn a note into a job here. */
export function FeedbackBoard() {
  const viewer = useViewer();
  const rows = useQuerySafe(api.feedback.list, hasConvex ? { limit: 100 } : "skip");
  const vote = useMutation(api.feedback.vote);
  const approve = useMutation(api.feedback.approve);
  const decline = useMutation(api.feedback.decline);
  const markDone = useMutation(api.feedback.markDone);
  const maintainer = viewer.signedIn && viewer.trust >= 3;
  return (
    <Ledger name="feedback" rows={hasConvex ? rows : []}>
      {(f) => {
        const st = STATUS[f.status] ?? STATUS.open!;
        return (
          <li key={f.id} data-feedback={f.id} data-status={f.status} className="flex items-start gap-3 border-t border-line px-4 py-3 first:border-t-0">
            <VoteButton
              votes={f.votes}
              pressed={f.myVote}
              disabled={f.status !== "open"}
              title={viewer.signedIn ? "Vote" : "Sign in to vote"}
              onClick={() => {
                track("feedback_vote", { signedIn: viewer.signedIn });
                return viewer.signedIn ? void vote({ feedbackId: f.id }).catch(() => {}) : viewer.signIn();
              }}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px]">{f.text}</span>
              <span className="placard flex flex-wrap items-center gap-2">
                <WhoAsked by={f.by} /> · {timeAgo(f.createdAt)} ·{" "}
                <span className={st.cls} data-feedback-status>
                  {st.label}
                </span>
                {f.issueUrl ? (
                  <a href={f.issueUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-accent">
                    · the job <ArrowUpRight size={11} />
                  </a>
                ) : null}
                {f.prUrl ? (
                  <a href={f.prUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-accent">
                    · the change <ArrowUpRight size={11} />
                  </a>
                ) : null}
              </span>
              {maintainer ? (
                <span className="mt-2 flex flex-wrap gap-2" data-feedback-admin>
                  {f.status === "open" ? (
                    <>
                      <button type="button" onClick={() => void approve({ feedbackId: f.id }).catch(() => {})} className="inline-flex h-7 items-center rounded-md bg-ink px-2.5 text-[12px] font-medium text-paper hover:opacity-90" title="Open a job for the coding agent: a GitHub issue that asks @claude for a pull request">
                        Approve → job
                      </button>
                      <button type="button" onClick={() => void decline({ feedbackId: f.id }).catch(() => {})} className="inline-flex h-7 items-center rounded-md border border-line px-2.5 text-[12px] text-ink-2 hover:border-line-2">
                        Decline
                      </button>
                    </>
                  ) : null}
                  {f.status === "approved" ? (
                    <button
                      type="button"
                      onClick={() => {
                        const prUrl = window.prompt("The pull request that shipped it (optional)") ?? undefined;
                        void markDone({ feedbackId: f.id, prUrl: prUrl || undefined }).catch(() => {});
                      }}
                      className="inline-flex h-7 items-center rounded-md border border-line px-2.5 text-[12px] text-ink-2 hover:border-line-2"
                    >
                      Mark shipped
                    </button>
                  ) : null}
                </span>
              ) : null}
            </span>
          </li>
        );
      }}
    </Ledger>
  );
}
