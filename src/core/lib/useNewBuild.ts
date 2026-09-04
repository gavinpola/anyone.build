import { useEffect, useRef, useState } from "react";
import { useRequests } from "./useRequests";
import { saveScroll } from "./view";

/**
 * Is there a newer build than the one this tab is running? The wall's data is live over Convex, but a
 * change that just shipped is new code. This polls /version.json once a minute and the moment
 * something goes live; when a newer build exists it refreshes the page on its own the first moment
 * you're not in the middle of something (no pointer or key for a few seconds, nothing focused, no
 * dialog open), coming back where you were (the room saves its view, pages save their scroll). A
 * hidden tab refreshes at once. The pill in the bar is the manual way while you're busy.
 */
const running = (import.meta.env.VITE_BUILD_SHA as string | undefined) || "";
// once a minute; every few seconds under the e2e flag so a test can watch a "new build" arrive
const POLL_MS = import.meta.env.VITE_E2E_BLOCKS ? 3_000 : 60_000;
const IDLE_MS = import.meta.env.VITE_E2E_BLOCKS ? 1_500 : 6_000;

let lastActivity = 0;
let listening = false;
function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  const mark = () => {
    lastActivity = Date.now();
  };
  for (const ev of ["pointerdown", "pointermove", "keydown", "touchstart", "wheel"] as const) window.addEventListener(ev, mark, { passive: true });
}

function busy(): boolean {
  if (Date.now() - lastActivity < IDLE_MS) return true;
  const a = document.activeElement;
  if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || (a as HTMLElement).isContentEditable)) return true;
  if (document.querySelector('[role="dialog"]')) return true;
  return false;
}

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

function refresh() {
  saveScroll();
  location.reload();
}

export function useNewBuild(): boolean {
  const [stale, setStale] = useState(false);
  const baseline = useRef<string | null>(running || null);
  const requests = useRequests();
  const liveCount = requests.filter((r) => r.status === "live").length;

  useEffect(() => {
    listen();
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
      if (document.visibilityState === "hidden") refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    // the quiet refresh: the first pause after the new build arrives
    const t = setInterval(() => {
      if (!busy()) refresh();
    }, 1000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(t);
    };
  }, [stale]);

  return stale;
}
