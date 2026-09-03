import { useLiveStats } from "@/core/lib/useLiveStats";

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

export function LiveCounters() {
  const s = useLiveStats();
  return (
    <div className="placard hidden items-center gap-2 rounded-full border border-line bg-card px-3 py-1 md:flex">
      <span className="live-dot" aria-hidden />
      <span className="text-ok">{fmt(s.online)} here</span>
      <span className="text-line-2">·</span>
      <span>{fmt(s.viewsAllTime)} views</span>
      <span className="text-line-2">·</span>
      <span>{fmt(s.changesAllTime)} {s.changesAllTime === 1 ? "change" : "changes"}</span>
    </div>
  );
}
