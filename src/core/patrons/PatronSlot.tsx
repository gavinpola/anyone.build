import { Link } from "@tanstack/react-router";

import { api } from "../../../convex/_generated/api";
import { hasConvex, useQuerySafe } from "@/core/lib/providers";

const siteUrl = (import.meta.env.VITE_CONVEX_SITE_URL as string | undefined) ?? "";
const usd = (c: number) => `$${(c / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

/** Today's patron in the header; when there is none, who's leading tomorrow's auction. */
export function PatronSlot() {
  const t = useQuerySafe(api.patrons.today, hasConvex ? {} : "skip");
  const p = t?.patron ?? null;
  const leader = t?.leader ?? null;
  if (!p) {
    return (
      <Link to="/leaderboard" className="patron-cta hidden items-center gap-1.5 xl:flex" data-patron-slot="open">
        <span className="placard">Patron of the day</span>
        {leader ? (
          <span className="text-[13px]">
            <span className="text-ink-2">nobody yet · </span>
            <span className="font-medium text-ink">{leader.name}</span>
            <span className="num text-accent"> {usd(leader.amountCents)}</span>
            <span className="text-ink-2"> leads tomorrow</span>
          </span>
        ) : (
          <span className="text-[13px] font-medium text-accent">this could be you</span>
        )}
        <span className="text-accent" aria-hidden>→</span>
      </Link>
    );
  }
  const href = p.url ? `${siteUrl}/go/${p.id}` : undefined;
  const inner = (
    <>
      <span className="placard">Patron of the day</span>
      {p.logoUrl ? <img src={p.logoUrl} alt="" className="h-4 w-4 rounded-sm object-cover" /> : null}
      <span className="font-semibold text-ink">{p.name}</span>
      {leader ? <span className="opacity-70"> · tomorrow: {leader.name} {usd(leader.amountCents)}</span> : null}
    </>
  );
  return href ? (
    <a href={href} target="_blank" rel="noopener sponsored" className="patron-cta hidden items-center gap-2 xl:flex" data-patron-slot="patron">
      {inner}
      <span className="text-accent" aria-hidden>↗</span>
    </a>
  ) : (
    <span className="placard hidden items-center gap-2 xl:flex" data-patron-slot="patron">{inner}</span>
  );
}
