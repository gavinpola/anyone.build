import { useSyncExternalStore } from "react";

/** The help panel's open state, shared so the header's "?" and the canvas's how-to can both open it. */
let open = false;
const ls = new Set<() => void>();
const emit = () => {
  for (const l of ls) l();
};
export const helpStore = {
  get: () => open,
  subscribe(l: () => void) {
    ls.add(l);
    return () => {
      ls.delete(l);
    };
  },
  open() {
    open = true;
    emit();
  },
  close() {
    open = false;
    emit();
  },
  toggle() {
    open = !open;
    emit();
  },
};
export function useHelpOpen() {
  return useSyncExternalStore(helpStore.subscribe, helpStore.get, helpStore.get);
}
