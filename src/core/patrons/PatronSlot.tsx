import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { hasConvex } from "@/core/lib/providers";

const siteUrl = (import.meta.env.VITE_CONVEX_SITE_URL as string | undefined) ?? "";
const usd = (c: number) => `$${(c / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

/** Today's patron in the header; when there is none, who's leading tomorrow's auction. */
export function PatronSlot() {
  const t = useQuery(api.patrons.today, hasConvex ? {} : "skip");
  const p = t?.patron ?? null;
  const leader = t?.leader ?? null;
  if (!p) {
    return (
      <Link to="/leaderboard" className="placard hidden items-center gap-2 rounded-full border border-dashed border-line px-3 py-1 hover:border-line-2 xl:flex">
        <span className="opacity-70">Patron of the day:</span>
        {leader ? (
          <span>
            <span className="text-ink-2">nobody yet</span>
            <span className="opacity-70"> · leading tomorrow: </span>
            <span className="font-semibold text-ink">{leader.name}</span>
            <span className="num text-accent"> {usd(leader.amountCents)}</span>
          </span>
        ) : (
          <span className="text-ink-2">this could be you</span>
        )}
      </Link>
    );
  }
  const href = p.url ? `${siteUrl}/go/${p.id}` : undefined;
  const inner = (
    <>
      <span className="opacity-70">Patron of the day:</span>
      {p.logoUrl ? <img src={p.logoUrl} alt="" className="h-4 w-4 rounded-sm object-cover" /> : null}
      <span className="font-semibold text-ink">{p.name}</span>
      {leader ? <span className="opacity-70"> · tomorrow: {leader.name} {usd(leader.amountCents)}</span> : null}
    </>
  );
  return href ? (
    <a href={href} target="_blank" rel="noopener sponsored" className="placard hidden items-center gap-2 rounded-full border border-line bg-card px-3 py-1 hover:border-accent xl:flex">
      {inner}
    </a>
  ) : (
    <span className="placard hidden items-center gap-2 rounded-full border border-line bg-card px-3 py-1 xl:flex">{inner}</span>
  );
}
