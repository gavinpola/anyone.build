import { Crosshair, X } from "lucide-react";
import { cn } from "@/core/lib/cn";
import { pickerStore, usePicker } from "./pickerStore";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** Discoverable entry into pick mode for people who don't know the chord. */
export function PickButton({ className, label = "Change something" }: { className?: string; label?: string }) {
  const { arming, sticky } = usePicker();
  const on = arming && sticky;
  return (
    <button
      type="button"
      onClick={() => (on ? pickerStore.disarm() : pickerStore.arm(true))}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] font-medium transition",
        on ? "border-accent bg-accent text-accent-ink" : "border-line bg-card text-ink hover:border-line-2",
        className,
      )}
      aria-pressed={on}
    >
      {on ? <X size={14} /> : <Crosshair size={14} />}
      <span className="pick-label">{on ? "Click anything" : label}</span>
      {!on ? (
        <span className="placard hidden items-center gap-0.5 sm:inline-flex">
          <kbd className="rounded border border-line bg-paper-2 px-1">⇧</kbd>
          <kbd className="rounded border border-line bg-paper-2 px-1">{isMac ? "⌘" : "Ctrl"}</kbd>
        </span>
      ) : null}
    </button>
  );
}
