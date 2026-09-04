import { useNewBuild } from "./useNewBuild";

/** Headless: keeps the tab on the current build without anything to click. */
export function QuietRefresh() {
  useNewBuild();
  return null;
}
