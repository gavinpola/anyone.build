import { useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useRequests } from "@/core/lib/useRequests";
import { useNow } from "@/core/lib/useNow";
import { PickButton } from "@/core/picker/PickButton";
import { RequestCard } from "./RequestCard";
import { feedStore, useFeedOpen } from "./feedStore";
import { cn } from "@/core/lib/cn";

const TERMINAL = new Set(["live", "rejected", "failed", "cancelled"]);

function useSortedRequests() {
  const all = useRequests();
  const now = useNow(1000);
  const sorted = useMemo(() => {
    return [...all].sort((a, b) => {
      const ap = (a.pinnedUntil ?? 0) > now ? 1 : 0;
      const bp = (b.pinnedUntil ?? 0) > now ? 1 : 0;
      return bp - ap || b.createdAt - a.createdAt;
    });
  }, [all, now]);
  return { sorted, now, active: sorted.filter((r) => !TERMINAL.has(r.status)).length };
}

/**
 * The feed lives in a drawer. The wall is the page; the feed is a window onto the machine.
 * Opens from the floating "Live" pill, or when the composer hands off to it.
 */
export function FeedRail() {
  const open = useFeedOpen();
  const { sorted, now, active } = useSortedRequests();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") feedStore.close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {/* floating controls */}
      {/* Above the drawer (z-55/56) so the pill stays a toggle while the drawer is open. */}
      <div className="fixed bottom-4 right-4 z-[60] flex items-center gap-2 lg:bottom-6 lg:right-6" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <span data-global-pick><PickButton /></span>
        <button
          type="button"
          onClick={() => feedStore.toggle()}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] font-medium shadow-frame transition",
            open ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink hover:border-line-2",
          )}
          aria-pressed={open}
        >
          <span className={active ? "judging-dot" : "live-dot"} />
          Live{active ? <span className="num">{active}</span> : null}
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <>
            <motion.div className="fixed inset-0 z-[55] bg-ink/20" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => feedStore.close()} />
            <motion.aside
              role="dialog"
              aria-label="Live feed"
              className="rail fixed inset-y-0 right-0 z-[56] flex w-full max-w-[420px] flex-col border-l border-line bg-paper"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 480, damping: 44 }}
            >
              <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                <span className={active ? "judging-dot" : "live-dot"} />
                <span className="placard smallcaps">Live</span>
                {active ? <span className="placard text-accent">{active} in flight</span> : null}
                <button type="button" onClick={() => feedStore.close()} className="ml-auto rounded p-1 text-muted hover:bg-paper-2 hover:text-ink" aria-label="Close">
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {sorted.length === 0 ? (
                  <p className="p-3 text-[13px] text-muted">Every approved request shows up here, for everyone, as it happens.</p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    <AnimatePresence initial={false}>
                      {sorted.map((r) => (
                        <RequestCard key={r.id} r={r} now={now} />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
