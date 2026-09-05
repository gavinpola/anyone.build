
import { api } from "../../../convex/_generated/api";
import { hasConvex, useQuerySafe } from "@/core/lib/providers";
import { tabSessionId } from "@/core/lib/session";
import { useLiveStats } from "@/core/lib/useLiveStats";

const initials = (s: string | null) => (s ? s.replace(/^guest[- ·]*/i, "g").slice(0, 2).toUpperCase() : "··");

/** Who's here, as an avatar stack: only the people whose cursors are on the wall right now. The count beside it says how many in all. */
export function PresenceStack() {
  const stats = useLiveStats();
  const peers = useQuerySafe(api.cursors.active, hasConvex ? { roomId: "main", sessionId: tabSessionId() } : "skip") ?? [];
  const others = Math.max(0, stats.online - 1);
  const shown = peers.slice(0, Math.min(3, others));
  if (shown.length === 0) return null;
  return (
    <div className="flex items-center" aria-label={`${stats.online} here`} data-presence={stats.online} title={`${stats.online} here right now`}>
      {shown.map((p, i) => (
        <span key={p.id} className="presence-dot" style={{ background: `hsl(${p.hue} 70% 45%)`, marginLeft: i ? -6 : 0, zIndex: 10 - i }} title={p.name ?? "someone"}>
          {initials(p.name)}
        </span>
      ))}
    </div>
  );
}
