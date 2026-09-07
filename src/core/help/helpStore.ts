import { useSyncExternalStore } from "react";
import { readPref, writePref } from "@/core/lib/prefs";

/**
 * The help card's open state, shared so the header's "?" and the canvas's "?" open the same card. It also
 * opens itself once, the first time a browser lands on the wall (firstVisit is true for that one showing):
 * the card is the demo, and a first visitor would not know to open it.
 */
let open = false;
let firstVisit = false;
const ls = new Set<() => void>();
const emit = () => {
  for (const l of ls) l();
};
const SEEN = "help:seen";
export const helpStore = {
  get: () => open,
  getFirstVisit: () => firstVisit,
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
    firstVisit = false;
    emit();
  },
  toggle() {
    if (open) helpStore.close();
    else helpStore.open();
  },
  /** The first landing only: open the card and remember that it was shown. Returns whether it opened. */
  openFirstVisit(): boolean {
    if (readPref(SEEN)) return false;
    writePref(SEEN, String(Date.now()));
    firstVisit = true;
    open = true;
    emit();
    return true;
  },
};
export function useHelpOpen() {
  return useSyncExternalStore(helpStore.subscribe, helpStore.get, helpStore.get);
}
export function useFirstVisit() {
  return useSyncExternalStore(helpStore.subscribe, helpStore.getFirstVisit, helpStore.getFirstVisit);
}
