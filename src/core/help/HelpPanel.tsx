import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useLiveStats } from "@/core/lib/useLiveStats";

const steps = [
  ["Point", "Hold ⇧⌘ and click anything on the wall. On a phone, long-press."],
  ["Ask", "Say what should change. One thing at a time."],
  ["Judged", "Good for everyone? It ships. Not? It doesn't. Unsure? A human looks."],
  ["Built", "An agent writes the code, checks it, and opens a pull request."],
  ["Live", "It merges and deploys. Sign in and your name is on the commit."],
];

const rules = [
  "Make it better for everyone, not just you.",
  "Build on, don't bulldoze.",
  "No ads, promo, or links out. Patrons pay for that.",
  "Nothing hidden, nothing that tracks people.",
  "Works on a phone or it doesn't ship.",
];

export function HelpPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useLiveStats();
  // Portaled: the sticky header's backdrop-blur would otherwise become the containing block for
  // these fixed elements and squash the panel into the header.
  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div className="fixed inset-0 z-[80] bg-ink/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-label="How this works"
            className="rail fixed inset-y-0 right-0 z-[81] w-full max-w-md overflow-y-auto border-l border-line bg-paper p-6"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 42 }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="placard smallcaps">How this works</p>
                <h2 className="mt-1 font-display text-3xl">Point. Ask. Watch it ship.</h2>
                <p className="mt-2 text-[14px] text-ink-2">An experiment: one website, no plan, built by whoever shows up.</p>
              </div>
              <button type="button" onClick={onClose} className="rounded p-1 text-muted hover:bg-paper-2 hover:text-ink" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <ol className="mt-6 flex flex-col gap-4">
              {steps.map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="placard w-6 shrink-0 pt-1">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="font-medium">{t}</p>
                    <p className="text-[13px] text-ink-2">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="placard smallcaps mt-8">House rules</p>
            <ul className="mt-2 flex flex-col gap-1.5 text-[14px]">
              {rules.map((r) => (
                <li key={r} className="border-t border-line pt-1.5 first:border-t-0 first:pt-0">{r}</li>
              ))}
            </ul>
            <p className="placard smallcaps mt-8">Right now</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-[14px]">
              <dt className="text-muted">Here</dt><dd className="tabular-nums">{s.online}</dd>
              <dt className="text-muted">Changes, all time</dt><dd className="tabular-nums">{s.changesAllTime}</dd>
              <dt className="text-muted">AI budget today</dt><dd className="tabular-nums">${(s.budgetSpentCents / 100).toFixed(2)} of ${(s.budgetCapCents / 100).toFixed(0)}</dd>
              <dt className="text-muted">From patrons, all time</dt><dd className="tabular-nums">${(s.revenueCents / 100).toFixed(0)}</dd>
            </dl>
            <p className="mt-8 text-[13px] text-muted">
              Open source, rules included. A change costs a few cents; patrons keep the budget full.
            </p>
            <p className="mt-2 text-[13px] text-muted">
              Want this on your own site?{" "}
              <Link to="/for-your-site" onClick={onClose} className="text-accent hover:underline underline-offset-2">
                It's one script tag.
              </Link>
            </p>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
