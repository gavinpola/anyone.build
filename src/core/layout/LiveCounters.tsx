import { useLiveStats } from "@/core/lib/useLiveStats";
import { cn } from "@/core/lib/cn";
import { PresenceStack } from "./PresenceStack";

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

function Stat({ value, label, live }: { value: number; label: string; live?: boolean }) {
  return (
    <span className="flex items-baseline gap-1.5">
      {live ? <span className="live-dot self-center" aria-hidden /> : null}
      <span className={cn("num text-[14px] font-medium leading-none", live ? "text-ok" : "text-ink")}>{fmt(value)}</span>
      <span className="text-[10px] font-medium uppercase tracking-[0.09em] text-muted">{label}</span>
    </span>
  );
}

/**
 * The live numbers, as quiet text: nothing here is clickable, so nothing here looks like a button.
 * Who's here sits right after the count, so the bubbles and the number can never disagree.
 */
export function LiveCounters() {
  const s = useLiveStats();
  return (
    <div className="ml-4 hidden items-center gap-3 md:flex lg:ml-7" data-live-counters>
      <Stat value={s.online} label="here" live />
      <PresenceStack />
      <span className="h-3 w-px bg-line-2/70" aria-hidden />
      <Stat value={s.viewsAllTime} label="views" />
      <span className="h-3 w-px bg-line-2/70" aria-hidden />
      <Stat value={s.changesAllTime} label={s.changesAllTime === 1 ? "change" : "changes"} />
    </div>
  );
}
