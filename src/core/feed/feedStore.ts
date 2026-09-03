import { useSyncExternalStore } from "react";

let open = false;
const ls = new Set<() => void>();
const emit = () => {
  for (const l of ls) l();
};
export const feedStore = {
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
export function useFeedOpen() {
  return useSyncExternalStore(
    (l) => {
      ls.add(l);
      return () => ls.delete(l);
    },
    () => open,
    () => open,
  );
}
