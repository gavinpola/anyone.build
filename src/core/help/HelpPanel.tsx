import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, X } from "lucide-react";
import { Link } from "@tanstack/react-router";

const REPO = "https://github.com/gavinpola/anyone.build";

const kbd = "inline-block rounded border border-line bg-paper-2 px-1.5 font-mono text-[11px] leading-5 text-ink";

/**
 * The help panel: three steps, the rules in one breath, and links to the real things. Short on
 * purpose; the pages it links to carry the detail.
 */
export function HelpPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  const go = "group flex items-center justify-between border-t border-line py-3 text-[14px] hover:text-accent";
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
            className="rail fixed inset-y-0 right-0 z-[81] flex w-full max-w-md flex-col overflow-y-auto border-l border-line bg-paper p-7"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 42 }}
          >
            <div className="flex items-start justify-between gap-4">
              <p className="placard smallcaps pt-1">How this works</p>
              <button type="button" onClick={onClose} className="-mr-2 -mt-1 rounded p-1.5 text-muted hover:bg-paper-2 hover:text-ink" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <h2 className="mt-3 font-display text-[34px] leading-[1.05] tracking-tight">Point. Ask. Watch it ship.</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-2">One website, built by whoever shows up. No plan, no sign-up, no queue.</p>

            <ol className="mt-8 flex flex-col gap-5">
              <li className="flex gap-4">
                <span className="num pt-0.5 font-mono text-[12px] text-accent">01</span>
                <div>
                  <p className="text-[15px] font-medium">Point</p>
                  <p className="mt-0.5 text-[14px] leading-relaxed text-ink-2">
                    Hold <kbd className={kbd}>⇧</kbd> <kbd className={kbd}>⌘</kbd> and click anything on the wall, or press <span className="font-medium text-ink">Change something</span>. On a phone: tap Change, then tap.
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="num pt-0.5 font-mono text-[12px] text-accent">02</span>
                <div>
                  <p className="text-[15px] font-medium">Ask</p>
                  <p className="mt-0.5 text-[14px] leading-relaxed text-ink-2">Say what should change, in plain words. One build per person at a time.</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="num pt-0.5 font-mono text-[12px] text-accent">03</span>
                <div>
                  <p className="text-[15px] font-medium">Ship</p>
                  <p className="mt-0.5 text-[14px] leading-relaxed text-ink-2">
                    A judge checks it's good for everyone, an agent writes the code, and it's live in a couple of minutes. Too big for one go? It goes up for a vote.
                  </p>
                </div>
              </li>
            </ol>

            <p className="placard smallcaps mt-9">The rules, in one breath</p>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-2">Better for everyone. Build on, don't bulldoze. Nothing hidden, no ads, no tracking. Works on a phone.</p>

            <nav className="mt-8" aria-label="Go deeper">
              <Link to="/rules" onClick={onClose} className={go}>
                <span>All the rules</span>
                <ArrowUpRight size={15} className="text-muted group-hover:text-accent" />
              </Link>
              <Link to="/leaderboard" onClick={onClose} className={go}>
                <span>The vote board and the leaderboard</span>
                <ArrowUpRight size={15} className="text-muted group-hover:text-accent" />
              </Link>
              <Link to="/faq" onClick={onClose} className={go}>
                <span>Questions people ask</span>
                <ArrowUpRight size={15} className="text-muted group-hover:text-accent" />
              </Link>
              <a href={REPO} target="_blank" rel="noopener noreferrer" className={go}>
                <span>The source, judge and all</span>
                <ArrowUpRight size={15} className="text-muted group-hover:text-accent" />
              </a>
              <Link to="/for-your-site" onClick={onClose} className={go + " border-b"}>
                <span>For your own site, it's one script tag</span>
                <ArrowUpRight size={15} className="text-muted group-hover:text-accent" />
              </Link>
            </nav>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
