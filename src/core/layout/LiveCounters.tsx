import { useLiveStats } from "@/core/lib/useLiveStats";
import { cn } from "@/core/lib/cn";

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

function Stat({ value, label, live }: { value: number; label: string; live?: boolean }) {
  return (
    <span className="flex items-baseline gap-1.5">
      {live ? <span className="live-dot self-center" aria-hidden /> : null}
      <span className={cn("num text-[15px] font-medium leading-none", live ? "text-ok" : "text-ink")}>{fmt(value)}</span>
      <span className="text-[10px] font-medium uppercase tracking-[0.09em] text-muted">{label}</span>
    </span>
  );
}

/** Live numbers, number-forward: the count is the hero, the label a quiet micro-cap. */
export function LiveCounters() {
  const s = useLiveStats();
  return (
    <div className="hidden items-center gap-3 rounded-full border border-line bg-card py-1 pl-3 pr-3.5 md:flex">
      <Stat value={s.online} label="here" live />
      <span className="h-3.5 w-px bg-line-2/70" aria-hidden />
      <Stat value={s.viewsAllTime} label="views" />
      <span className="h-3.5 w-px bg-line-2/70" aria-hidden />
      <Stat value={s.changesAllTime} label={s.changesAllTime === 1 ? "change" : "changes"} />
    </div>
  );
}
