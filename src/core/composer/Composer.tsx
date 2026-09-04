import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, X } from "lucide-react";
import { pickerStore, usePicker, type PickerTarget } from "@/core/picker/pickerStore";
import { submitRequest, useRequest } from "@/core/lib/useRequests";
import { useViewer } from "@/core/auth/useViewer";
import { REJECTION_COPY, STAGE_COPY } from "@/core/lib/types";
import { cn } from "@/core/lib/cn";
import { feedStore } from "@/core/feed/feedStore";
import { ShareButton, shareUrl } from "@/core/share/ShareButton";
import { friendlyError } from "@/core/lib/errors";

const EXAMPLES = [
  "A guestbook where anyone can leave one line",
  "A big button that counts how many times the world has pressed it",
  "A poll: what should this wall become?",
  "Make this say something braver",
  "Turn this into a countdown to midnight ET",
  "Add a 'newest first' toggle",
  "Give this a second column with tiny sparklines",
  "Make the numbers tick up instead of jumping",
  "Add a one-line rule: no yelling",
];

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function Composer() {
  const { selected } = usePicker();
  // The panel receives its target as a prop so it stays valid during the exit animation,
  // after the store has already cleared the selection.
  return (
    <AnimatePresence>{selected ? <ComposerPanel key={selected.path + selected.line} target={selected} /> : null}</AnimatePresence>
  );
}

function ComposerPanel({ target: t }: { target: PickerTarget }) {
  const viewer = useViewer();
  const [prompt, setPrompt] = useState(t.draft ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  // A re-select on the same spot while the previous panel is still animating out reuses this
  // instance (same key), so the previous request's state would otherwise survive. Each new target
  // object means a new open: reset during render (React's "adjust state when a prop changes"
  // pattern), which is cheaper than an effect and never cascades.
  const [forTarget, setForTarget] = useState(t);
  if (forTarget !== t) {
    setForTarget(t);
    setPrompt(t.draft ?? "");
    setSubmittedId(null);
    setError(null);
    setSending(false);
  }
  const request = useRequest(submittedId);
  const ref = useRef<HTMLTextAreaElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean }>({ top: 0, left: 0, above: false });
  const example = useMemo(() => EXAMPLES[(t.line + t.path.length) % EXAMPLES.length]!, [t.line, t.path]);

  // Anchor near the selection, flipping above if there is no room below.
  useLayoutEffect(() => {
    const W = Math.min(440, window.innerWidth - 16);
    const H = boxRef.current?.offsetHeight ?? 220;
    const r = t.rect;
    // Big targets (the whole wall, a tall block): open right where the click happened.
    const huge = r.height > window.innerHeight * 0.45;
    if (huge && t.point) {
      const top = Math.min(t.point.y + 16, window.innerHeight - H - 8);
      const left = Math.max(8, Math.min(t.point.x - 40, window.innerWidth - W - 8));
      setPos({ top: Math.max(72, top), left, above: false });
      return;
    }
    const below = r.bottom + 12 + H <= window.innerHeight - 8;
    const top = below ? r.bottom + 12 : Math.max(72, r.top - 12 - H);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - W - 8));
    setPos({ top, left, above: !below });
  }, [t, request?.status]);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  async function send() {
    const p = prompt.trim();
    if (!p || sending) return;
    setSending(true);
    setError(null);
    const { rect: _r, element: _e, point: _p, granularity: _g, ...target } = t;
    try {
      const id = await submitRequest({ prompt: p, target, handle: viewer.handle, avatarUrl: viewer.avatarUrl });
      setSubmittedId(id);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSending(false);
    }
  }

  const done = request && ["live", "rejected", "failed", "cancelled"].includes(request.status);
  const rejected = request?.status === "rejected";
  const copy = rejected && request.verdict?.category ? REJECTION_COPY[request.verdict.category] : null;

  return createPortal(
    <motion.div
      ref={boxRef}
      role="dialog"
      aria-label="Ask for a change"
      initial={{ opacity: 0, y: pos.above ? 6 : -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: pos.above ? 6 : -6, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 520, damping: 38, mass: 0.6 }}
      style={{ top: pos.top, left: pos.left, width: Math.min(440, window.innerWidth - 16) }}
      className="fixed z-[70] overflow-hidden rounded-xl border border-line bg-card shadow-frame"
    >
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="placard truncate">
          <span className="text-accent">{t.blockTitle ?? t.blockId ?? "wall"}</span>
          <span className="opacity-60"> · </span>
          {t.tag === "region" ? "this space" : t.line === 0 ? "add something here" : `<${t.tag}>`}
          {t.line !== 0 ? (
            <>
              <span className="opacity-60"> · </span>
              <span className="opacity-80">{t.path.replace("src/rooms/main/blocks/", "")}:{t.line}</span>
            </>
          ) : null}
        </span>
        <button type="button" onClick={() => pickerStore.clear()} className="ml-auto rounded p-1 text-muted hover:bg-paper-2 hover:text-ink" aria-label="Dismiss">
          <X size={14} />
        </button>
      </div>
      {t.text ? (
        <div className="border-b border-line bg-paper-2/60 px-3 py-1.5 text-[12px] text-ink-2">
          <span className="placard">{t.granularity === "word" ? "the word" : "says"}</span> “{t.text}”
        </div>
      ) : null}

      {!submittedId ? (
        <div className="p-3">
          <textarea
            ref={ref}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, 600))}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void send();
              }
            }}
            rows={3}
            placeholder={example}
            className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-ink outline-none placeholder:text-muted"
          />
          {error ? <p role="alert" className="mt-2 rounded-md bg-bad-soft px-3 py-2 text-[13px] text-bad">{error}</p> : null}
          <div className="mt-2 flex items-center gap-2">
            <span className="placard">
              <kbd className="rounded border border-line bg-paper-2 px-1">{isMac ? "⌘" : "Ctrl"}</kbd>
              <kbd className="ml-0.5 rounded border border-line bg-paper-2 px-1">↵</kbd> to send
              {!viewer.signedIn ? (
                <>
                  {" "}· no account needed ·{" "}
                  <button type="button" onClick={viewer.signIn} className="underline hover:text-ink">
                    sign in to keep credit
                  </button>
                </>
              ) : (
                " · esc to close"
              )}
            </span>
            <span className="ml-auto placard tabular-nums">{prompt.length}/600</span>
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || !prompt.trim()}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition",
                "bg-accent text-accent-ink hover:brightness-95 disabled:opacity-40",
              )}
            >
              Send <ArrowUp size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3">
          <p className="text-[14px] text-ink-2">“{prompt}”</p>
          <div className="mt-3 flex items-center gap-2">
            {request?.status === "judging" ? (
              <>
                <span className="judging-dot" />
                <span className="text-[13px]">Judging…</span>
              </>
            ) : rejected ? (
              <div className="w-full rounded-md bg-bad-soft p-3">
                <p className="text-[14px] font-medium text-bad">{copy?.title ?? "Rejected"}</p>
                <p className="mt-0.5 text-[13px] text-ink-2">{request?.verdict?.hint ?? copy?.hint}</p>
              </div>
            ) : request?.status === "live" ? (
              <div className="w-full rounded-md bg-ok-soft p-3">
                <p className="text-[14px] font-medium text-ok">It's live.</p>
                <p className="mt-0.5 text-[13px] text-ink-2">Your change is on the wall for everyone. Send someone the link.</p>
                <div className="mt-2">
                  <ShareButton label="Share it" url={shareUrl("c", request.id)} title={request.prompt} text="Made on anyone.build, the website anyone can change" />
                </div>
              </div>
            ) : request?.status === "proposed" ? (
              <div className="w-full rounded-md bg-accent-soft p-3">
                <p className="text-[14px] font-medium text-accent">Up for a vote.</p>
                <p className="mt-0.5 text-[13px] text-ink-2">This one's big, so the wall put it up for a vote on the leaderboard. Every three hours the most-wanted one is built and the rest start over. Send friends the link to get votes.</p>
                <div className="mt-2">
                  <ShareButton label="Share to get votes" url={shareUrl("p", request.id)} title={request.prompt} text="Vote for this on anyone.build" />
                </div>
              </div>
            ) : request?.status === "needs_human" ? (
              <div className="w-full rounded-md bg-warn-soft p-3">
                <p className="text-[14px] font-medium text-warn">Not this time.</p>
                <p className="mt-0.5 text-[13px] text-ink-2">{request.verdict?.hint || "This one sat in an old queue that no longer exists. Ask again and the judge will decide."}</p>
              </div>
            ) : request?.status === "failed" || request?.status === "cancelled" ? (
              <div className="w-full rounded-md bg-paper-2 p-3">
                <p className="text-[14px] font-medium">{request.status === "failed" ? "It didn't make it." : "Cancelled."}</p>
                <p className="mt-0.5 text-[13px] text-ink-2">{request.verdict?.hint || "Try a smaller ask."}</p>
              </div>
            ) : (
              <div className="w-full rounded-md bg-ok-soft p-3">
                <p className="text-[14px] font-medium text-ok">Approved. Building now.</p>
                <p className="mt-0.5 text-[13px] text-ink-2">
                  {request ? (STAGE_COPY[request.status] ?? request.status) : "Queued"}
                  {request?.stage ? ` · ${request.stage}` : ""}. Follow it in the feed.
                </p>
              </div>
            )}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            {done ? (
              <button type="button" onClick={() => pickerStore.clear()} className="h-8 rounded-md border border-line px-3 text-[13px] hover:border-line-2">
                Close
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  pickerStore.clear();
                  feedStore.open();
                }}
                className="h-8 rounded-md border border-line px-3 text-[13px] hover:border-line-2"
              >
                Watch it in Live
              </button>
            )}
          </div>
        </div>
      )}
    </motion.div>,
    document.body,
  );
}
