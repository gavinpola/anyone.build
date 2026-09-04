import { useEffect, useRef, useState } from "react";
import { useRequests } from "./useRequests";

/**
 * Is there a newer build than the one this tab is running? The wall's data is live over Convex, but a
 * change that just shipped is new code: it shows up after a reload. This polls /version.json once a
 * minute and the moment something goes live, and reloads on its own when the tab is hidden, so the
 * next look is always at the current wall. Nothing is known in dev (no version.json).
 */
const running = (import.meta.env.VITE_BUILD_SHA as string | undefined) || "";
// once a minute; every few seconds under the e2e flag so a test can watch a "new build" arrive
const POLL_MS = import.meta.env.VITE_E2E_BLOCKS ? 3_000 : 60_000;

async function fetchSha(): Promise<string | null> {
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return null;
    const j = (await r.json()) as { sha?: string };
    return typeof j.sha === "string" && j.sha ? j.sha : null;
  } catch {
    return null;
  }
}

export function useNewBuild(): boolean {
  const [stale, setStale] = useState(false);
  const baseline = useRef<string | null>(running || null);
  const requests = useRequests();
  const liveCount = requests.filter((r) => r.status === "live").length;

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const sha = await fetchSha();
      if (!alive || !sha) return;
      if (!baseline.current) baseline.current = sha; // dev / unknown build: the first answer is the baseline
      else if (sha !== baseline.current) setStale(true);
    };
    void check();
    const t = setInterval(() => void check(), POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [liveCount]); // something just went live: look again now

  useEffect(() => {
    if (!stale) return;
    const onVis = () => {
      if (document.visibilityState === "hidden") location.reload();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [stale]);

  return stale;
}
