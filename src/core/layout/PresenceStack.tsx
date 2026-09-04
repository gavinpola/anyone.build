import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { hasConvex } from "@/core/lib/providers";
import { tabSessionId } from "@/core/lib/session";
import { useLiveStats } from "@/core/lib/useLiveStats";

const initials = (s: string | null) => (s ? s.replace(/^guest[- ·]*/i, "g").slice(0, 2).toUpperCase() : "··");

/** Who's here, as an avatar stack: the people whose cursors are on the wall, then +N for the rest. */
export function PresenceStack() {
  const stats = useLiveStats();
  const peers = useQuery(api.cursors.active, hasConvex ? { roomId: "main", sessionId: tabSessionId() } : "skip") ?? [];
  const shown = peers.slice(0, 4);
  const rest = Math.max(0, stats.online - 1 - shown.length);
  if (stats.online < 2) return null;
  return (
    <div className="hidden items-center md:flex" aria-label={`${stats.online} here`} data-presence={stats.online}>
      {shown.map((p, i) => (
        <span key={p.id} className="presence-dot" style={{ background: `hsl(${p.hue} 70% 45%)`, marginLeft: i ? -6 : 0, zIndex: 10 - i }} title={p.name ?? "someone"}>
          {initials(p.name)}
        </span>
      ))}
      {rest > 0 ? <span className="presence-dot presence-more" style={{ marginLeft: shown.length ? -6 : 0 }}>+{rest}</span> : null}
    </div>
  );
}
