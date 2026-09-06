import { useSyncExternalStore } from "react";

/**
 * Which object has the keyboard. One block at a time is "active": the one you last tapped, or the one
 * the map or a toast took you to. While a block is active, key presses go to it (through `useKeys` in
 * the kit, and through focus for blocks that listen on a focusable element) and the arrow keys stop
 * walking the world. Tap the ground or press Escape to take the keys back.
 */
type State = { active: string | null };

let state: State = { active: null };
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

/** The live sets of keys held down, one per mounted `useKeys` call, by block id. */
const sets = new Map<string, Set<Set<string>>>();
let installed = false;

const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "PageUp", "PageDown", "Home", "End"]);

function editable(el: EventTarget | null): boolean {
  const e = el as HTMLElement | null;
  if (!e || !e.closest) return false;
  return Boolean(e.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']"));
}

function clearAll(id?: string | null) {
  for (const [bid, group] of sets) {
    if (id && bid !== id) continue;
    for (const s of group) s.clear();
  }
}

/** Route one key event to the active block's sets. Returns true when a block took it. Exported for tests. */
export function routeKey(e: { type: string; key: string; target: EventTarget | null; preventDefault?: () => void; repeat?: boolean }): boolean {
  const id = state.active;
  if (!id || editable(e.target)) return false;
  const group = sets.get(id);
  if (!group || !group.size) return false;
  if (e.type === "keydown") {
    for (const s of group) s.add(e.key);
    if (SCROLL_KEYS.has(e.key)) e.preventDefault?.(); // the page and the world hold still while a game has the keys
  } else if (e.type === "keyup") {
    for (const s of group) s.delete(e.key);
  }
  return true;
}

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const onKey = (e: KeyboardEvent) => {
    routeKey(e);
  };
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
  window.addEventListener("blur", () => clearAll());
  document.addEventListener("visibilitychange", () => document.hidden && clearAll());
}

export const keysStore = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** Give a block the keys. */
  activate(id: string) {
    if (state.active === id) return;
    clearAll(state.active);
    state = { active: id };
    emit();
  },
  /** Take the keys back (the ground, Escape, a block that left the wall). */
  deactivate(id?: string) {
    if (!state.active || (id && state.active !== id)) return;
    clearAll(state.active);
    state = { active: null };
    emit();
  },
  /** A `useKeys` call registers the Set it fills; the store keeps it while the block is mounted. */
  bind(id: string, set: Set<string>) {
    install();
    let group = sets.get(id);
    if (!group) {
      group = new Set();
      sets.set(id, group);
    }
    group.add(set);
    return () => {
      group!.delete(set);
      if (!group!.size) sets.delete(id);
      set.clear();
    };
  },
  /** Does this block read the keyboard through useKeys? (Blocks that listen on a focusable element are found in the DOM.) */
  listens(id: string) {
    return (sets.get(id)?.size ?? 0) > 0;
  },
  /** For tests: forget everything. */
  reset() {
    state = { active: null };
    sets.clear();
    emit();
  },
};

export function useActiveBlock(): string | null {
  return useSyncExternalStore(keysStore.subscribe, () => state.active, () => state.active);
}
