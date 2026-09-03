import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { hasConvex } from "./providers";
import { useRoomPresenceCount } from "./usePresence";

export type LiveStats = {
  online: number;
  changesToday: number;
  changesAllTime: number;
  budgetSpentCents: number;
  budgetCapCents: number;
  revenueCents: number;
  viewsAllTime: number;
};

function useLiveStatsMock(): LiveStats {
  return { online: 1, changesToday: 0, changesAllTime: 0, budgetSpentCents: 0, budgetCapCents: 2000, revenueCents: 0, viewsAllTime: 0 };
}
function useLiveStatsConvex(): LiveStats {
  const g = useQuery(api.stats.global, {});
  const b = useQuery(api.budget.today, {});
  const online = useRoomPresenceCount();
  return {
    online: Math.max(1, online),
    changesToday: g?.changesToday ?? 0,
    changesAllTime: g?.changesAllTime ?? 0,
    budgetSpentCents: b?.spentCents ?? 0,
    budgetCapCents: b?.capCents ?? 2000,
    revenueCents: g?.revenueCents ?? 0,
    viewsAllTime: g?.viewsAllTime ?? 0,
  };
}
export const useLiveStats: () => LiveStats = hasConvex ? useLiveStatsConvex : useLiveStatsMock;
