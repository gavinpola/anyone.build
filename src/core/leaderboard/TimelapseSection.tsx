import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { Pause, Play } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { hasConvex } from "@/core/lib/providers";

/** The wall, every hour: a scrubbable timelapse of what the screen looked like. This page can't be changed by the wall. */
export function TimelapseSection() {
  const frames = useQuery(api.timelapse.list, hasConvex ? { limit: 96 } : "skip");
  const [i, setI] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const n = frames?.length ?? 0;
  const idx = i == null ? Math.max(0, n - 1) : Math.min(i, Math.max(0, n - 1));
  useEffect(() => {
    if (!playing || n < 2) return;
    const t = setInterval(() => setI((cur) => ((cur ?? n - 1) + 1) % n), 400);
    return () => clearInterval(t);
  }, [playing, n]);
  const f = frames?.[idx];
  const when = (at: number) => new Date(at).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric" });
  return (
    <section data-timelapse={n}>
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl">The wall, every hour</h2>
        <span className="placard">{n ? `${n} frames · last 30 days` : ""}</span>
      </div>
      <div className="frame mt-3 overflow-hidden">
        {!frames ? (
          <p className="p-5 text-[14px] text-muted">Loading…</p>
        ) : n === 0 ? (
          <p className="p-5 text-[14px] text-muted">The first frame lands at the top of the next hour.</p>
        ) : (
          <div>
            <div className="relative bg-paper-2">
              <img src={f!.url} alt={`The wall at ${when(f!.at)}`} width={f!.width} height={f!.height} className="block h-auto w-full" loading="lazy" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-ink/70 to-transparent px-4 pb-3 pt-10 text-[13px] text-paper">
                <span>{when(f!.at)} ET</span>
                <span>
                  {f!.changes} changes · {f!.here} here
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-line px-4 py-3">
              <button type="button" onClick={() => setPlaying((p) => !p)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line hover:border-line-2" aria-label={playing ? "Pause" : "Play"} disabled={n < 2}>
                {playing ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <input
                type="range"
                min={0}
                max={Math.max(0, n - 1)}
                value={idx}
                onChange={(e) => {
                  setPlaying(false);
                  setI(Number(e.target.value));
                }}
                className="flex-1 accent-[var(--accent)]"
                aria-label="Scrub through the hours"
              />
              <span className="placard w-16 text-right tabular-nums">
                {idx + 1} / {n}
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
