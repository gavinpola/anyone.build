import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { hasConvex } from "./providers";

type Prov = { lastBy: string | null; guestTag: string | null; changes: number };
function useMock(): Prov {
  return { lastBy: null, guestTag: null, changes: 0 };
}
function useConvex(blockId: string): Prov {
  const all = useQuery(api.leaderboard.blockProvenance, {});
  const p = all?.[blockId];
  return p ? { lastBy: p.lastBy, guestTag: p.guestTag, changes: p.changes } : { lastBy: null, guestTag: null, changes: 0 };
}
export const useBlockProvenance: (blockId: string) => Prov = hasConvex ? useConvex : useMock;
