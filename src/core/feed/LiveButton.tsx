import { cn } from "@/core/lib/cn";
import { feedStore, useFeedOpen } from "./feedStore";
import { useActiveCount } from "./active";
import { track } from "@/core/lib/analytics";

/** The Live toggle: opens the feed drawer. It sits in the canvas bar on the wall and floats as a pill on other pages. */
export function LiveButton({ className }: { className?: string }) {
  const open = useFeedOpen();
  const active = useActiveCount();
  return (
    <button
      type="button"
      onClick={() => {
        track("live_toggle", { open: !open });
        feedStore.toggle();
      }}
      aria-pressed={open}
      data-live-button
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] font-medium shadow-frame transition",
        open ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink hover:border-line-2",
        className,
      )}
    >
      <span className={active ? "judging-dot" : "live-dot"} aria-hidden />
      Live{active ? <span className="num">{active}</span> : null}
    </button>
  );
}
