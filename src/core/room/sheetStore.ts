import { useSyncExternalStore } from "react";

/**
 * The object sheet: tap an object's label (or long-press the object) and a small sheet says who made it,
 * how long it has left, and offers Change and Move. One sheet at a time; the picker and the room both
 * open it, so it lives in a tiny store of its own.
 */
type SheetState = { blockId: string | null; moving: string | null };

let state: SheetState = { blockId: null, moving: null };
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

export const sheetStore = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  open(blockId: string) {
    state = { blockId, moving: null };
    emit();
  },
  close() {
    if (!state.blockId && !state.moving) return;
    state = { blockId: null, moving: null };
    emit();
  },
  /** Start moving a block: the sheet closes and the next tap on the ground says where it goes. */
  startMove(blockId: string) {
    state = { blockId: null, moving: blockId };
    emit();
  },
  stopMove() {
    if (!state.moving) return;
    state = { ...state, moving: null };
    emit();
  },
};

export function useSheet(): SheetState {
  return useSyncExternalStore(sheetStore.subscribe, sheetStore.get, sheetStore.get);
}
