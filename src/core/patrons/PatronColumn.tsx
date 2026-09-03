import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { hasConvex } from "@/core/lib/providers";
import { useNow } from "@/core/lib/useNow";
import { useLiveStats } from "@/core/lib/useLiveStats";
import { BidDialog } from "./BidDialog";

const siteUrl = (import.meta.env.VITE_CONVEX_SITE_URL as string | undefined) ?? "";
const usd = (c: number) => `$${(c / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const n = (x: number) => x.toLocaleString("en-US");

function countdown(to: number, now: number) {
  const s = Math.max(0, Math.floor((to - now) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(s % 60).padStart(2, "0")}s`;
}

/** The right-hand column of the leaderboard: today's patron, tomorrow's auction, three answers. */
export function PatronColumn() {
  const board = useQuery(api.patrons.board, hasConvex ? {} : "skip");
  const history = useQuery(api.patrons.history, hasConvex ? { limit: 7 } : "skip");
  const stats = useLiveStats();
  const now = useNow(1000);
  const [open, setOpen] = useState(false);
  const toBeat = board?.toBeatCents ?? 500;
  const patron = board?.patron ?? null;
  const high = board?.high ?? null;

  return (
    <aside className="flex flex-col gap-4">
      {/* Today */}
      <h2 className="font-display text-2xl">Patron of the day</h2>
      <div className="frame -mt-1 overflow-hidden">
        {patron ? (
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-paper-2 text-xl font-bold">
              {patron.logoUrl ? <img src={patron.logoUrl} alt="" className="h-full w-full object-cover" /> : patron.name.slice(0, 1)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px] font-semibold">{patron.name}</span>
              {patron.blurb ? <span className="block truncate text-[13px] text-ink-2">{patron.blurb}</span> : null}
              <span className="placard flex gap-2">
                {patron.url ? (
                  <a href={`${siteUrl}/go/${patron.id}`} target="_blank" rel="noopener sponsored" className="hover:text-accent">
                    {new URL(patron.url).hostname.replace(/^www\./, "")} ↗
                  </a>
                ) : null}
                <span className="num">{n(patron.clicks)} clicks</span>
                <span className="num">won at {usd(patron.amountCents)}</span>
              </span>
            </span>
          </div>
        ) : (
          <div className="px-4 py-4">
            <p className="font-display text-3xl">This could be you.</p>
            <p className="mt-1 text-[14px] text-ink-2">Your name, logo, and link up top, all day, in front of {n(stats.viewsAllTime)} views and counting.</p>
          </div>
        )}
        {board?.runnersUp.length ? (
          <div className="flex items-center gap-2 border-t border-line px-4 py-2">
            <span className="placard shrink-0">also bid today</span>
            <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
              {board.runnersUp.map((b) => (
                <span key={b.id} title={`${b.name} · ${usd(b.amountCents)}`} className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded border border-line bg-paper-2 text-[11px] font-bold">
                  {b.logoUrl ? <img src={b.logoUrl} alt={b.name} className="h-full w-full object-cover" /> : b.name.slice(0, 1)}
                </span>
              ))}
            </span>
          </div>
        ) : null}
      </div>

      {/* Tomorrow's auction */}
      <div className="mt-2 flex items-baseline justify-between">
        <h2 className="font-display text-2xl">Tomorrow's slot</h2>
        <span className="placard num">closes in {countdown(board?.closesAt ?? now, now)}</span>
      </div>
      <div className="frame -mt-1 overflow-hidden border-accent/50">
        <div className="px-4 py-4">
          <p className="placard">Highest bid at midnight ET wins. Only the winner pays.</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display num text-5xl text-accent">{usd(high?.amountCents ?? 0)}</span>
            <span className="text-[13px] text-ink-2">{high ? `high bid · ${high.name}` : "no bids yet"}</span>
          </div>
          <button type="button" onClick={() => setOpen(true)} className="mt-3 h-11 w-full rounded-md bg-accent text-[15px] font-semibold text-accent-ink hover:brightness-95">
            Bid {usd(toBeat)}
          </button>
          {board?.myBid ? (
            <p className="placard mt-2">
              your bid: <span className="num text-ink">{usd(board.myBid.amountCents)}</span> · #{board.myBid.rank}
              {board.myBid.rank > 1 ? <span className="text-accent"> · outbid</span> : null}
            </p>
          ) : null}
        </div>
        {board?.bids.length ? (
          <ol className="border-t border-line">
            {board.bids.slice(0, 5).map((b) => (
              <li key={b.id} className="flex items-center gap-3 border-t border-line px-4 py-2.5 first:border-t-0">
                <span className="placard num w-6">#{b.rank}</span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-paper-2 text-[13px] font-bold">
                  {b.logoUrl ? <img src={b.logoUrl} alt="" className="h-full w-full object-cover" /> : b.name.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{b.name}</span>
                  {b.url ? <span className="placard block truncate">{new URL(b.url).hostname.replace(/^www\./, "")}</span> : null}
                </span>
                <span className="num text-[15px] font-semibold">{usd(b.amountCents)}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      {history && history.length ? (
        <div className="frame overflow-hidden">
          <div className="border-b border-line px-4 py-2 text-[14px] font-semibold">Past days</div>
          <ul>
            {history.map((d) => (
              <li key={d.day} className="flex items-center gap-2 border-t border-line px-4 py-2 first:border-t-0">
                <span className="placard num w-12">{d.day.slice(5).replace("-", "/")}</span>
                <span className="min-w-0 flex-1 truncate text-[13px]">{d.winner?.name ?? "nobody"}</span>
                <span className="num text-[13px]">{d.winningCents ? usd(d.winningCents) : "—"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <BidDialog open={open} onClose={() => setOpen(false)} suggestedCents={toBeat} minCents={board?.minBidCents ?? 500} slotDay={board?.slotDay ?? ""} />
    </aside>
  );
}
