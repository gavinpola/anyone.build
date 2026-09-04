import { useMemo } from "react";
import { useRequests } from "@/core/lib/useRequests";

/** Statuses that are over: everything else is in flight. */
export const TERMINAL = new Set(["live", "rejected", "failed", "cancelled"]);

/** How many asks are in flight right now: the number on the Live button. */
export function useActiveCount(): number {
  const all = useRequests();
  return useMemo(() => all.filter((r) => !TERMINAL.has(r.status)).length, [all]);
}
