/**
 * Where you were: the room's camera (and a page's scroll), kept in sessionStorage across the quiet
 * refresh that brings in a newly landed change, so the world updates under you without moving.
 * Ten minutes old is stale; a different world key (the geometry changed) means the saved view no longer applies.
 */
const FRESH_MS = 10 * 60 * 1000;

export type SavedView = { cam: { x: number; y: number }; world: string; at: number };

export function saveView(v: Omit<SavedView, "at">): void {
  try {
    sessionStorage.setItem("ab:view", JSON.stringify({ ...v, at: Date.now() }));
  } catch {
    /* storage blocked: the next load simply lands where the action is */
  }
}

export function loadView(world: string): SavedView | null {
  try {
    const raw = sessionStorage.getItem("ab:view");
    if (!raw) return null;
    const v = JSON.parse(raw) as SavedView;
    if (!v || v.world !== world || Date.now() - v.at > FRESH_MS) return null;
    if (!Number.isFinite(v.cam?.x) || !Number.isFinite(v.cam?.y)) return null;
    return v;
  } catch {
    return null;
  }
}

export function saveScroll(): void {
  try {
    sessionStorage.setItem("ab:scroll", JSON.stringify({ path: location.pathname, y: window.scrollY, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

export function restoreScroll(): void {
  try {
    const raw = sessionStorage.getItem("ab:scroll");
    if (!raw) return;
    sessionStorage.removeItem("ab:scroll");
    const s = JSON.parse(raw) as { path: string; y: number; at: number };
    if (s.path === location.pathname && Date.now() - s.at < FRESH_MS && s.y > 0) window.scrollTo(0, s.y);
  } catch {
    /* ignore */
  }
}
