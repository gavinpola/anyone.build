import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { hasConvex } from "@/core/lib/providers";
import { Avatar } from "@/core/feed/RequestCard";
import { cn } from "@/core/lib/cn";

type Period = "week" | "all";
const n = (x: number) => x.toLocaleString("en-US");

export function BuildersSection() {
  const [period, setPeriod] = useState<Period>("week");
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl">Builders</h2>
        <div className="flex rounded-full border border-line bg-card p-0.5">
          {(["week", "all"] as const).map((p) => (
            <button key={p} type="button" onClick={() => setPeriod(p)} className={cn("rounded-full px-3 py-1 text-[13px] font-medium", period === p ? "bg-ink text-paper" : "text-ink-2 hover:text-ink")}>
              {p === "week" ? "This week" : "All time"}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 grid gap-4 xl:grid-cols-2">
        <Board period={period} metric="changes" title="By changes shipped" />
        <Board period={period} metric="lines" title="By lines pushed" />
      </div>
    </section>
  );
}

function Board({ period, metric, title }: { period: Period; metric: "changes" | "lines"; title: string }) {
  const rows = useQuery(api.leaderboard.top, hasConvex ? { period, metric, limit: 10 } : "skip");
  const value = (r: NonNullable<typeof rows>[number]) =>
    metric === "changes" ? (period === "week" ? (r.weekChanges ?? 0) : r.liveChanges) : period === "week" ? (r.weekLines ?? 0) : r.linesChanged;
  const max = Math.max(1, ...(rows ?? []).map(value));
  return (
    <div className="frame overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <span className="text-[14px] font-semibold">{title}</span>
        <span className="placard">{metric === "changes" ? "changes" : "lines"}</span>
      </div>
      {rows && rows.length ? (
        <ol>
          {rows.map((r, i) => {
            const v = value(r);
            return (
              <li key={r.id} className="relative flex items-center gap-3 border-t border-line px-4 py-2.5 first:border-t-0">
                <span aria-hidden className="absolute inset-y-0 left-0 bg-accent-soft/50" style={{ width: `${(100 * v) / max}%` }} />
                <span className={cn("font-display num relative w-8 text-xl", i === 0 ? "text-accent" : "text-ink-2")}>{i + 1}</span>
                <Avatar handle={r.handle} url={r.avatarUrl} size={24} />
                <span className="relative min-w-0 flex-1 truncate text-[15px] font-medium">@{r.handle}</span>
                <span className="placard relative hidden sm:inline">{r.standing} standing</span>
                <span className="font-display num relative text-xl">{n(v)}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="p-5 text-[14px] text-muted">Nobody yet.</p>
      )}
    </div>
  );
}
