import { useSyncExternalStore } from "react";
import type { Target } from "@/core/lib/types";

export type PickerTarget = Target & {
  rect: DOMRect;
  element: HTMLElement;
  point?: { x: number; y: number };
  /** "word" when the pointer is over a specific word of text inside the element */
  granularity?: "element" | "word" | "block";
};

type State = {
  /** true while the modifier chord is held or "pick mode" was toggled on */
  arming: boolean;
  /** true when arming was toggled via the UI button (sticky until a pick or Esc) */
  sticky: boolean;
  hover: PickerTarget | null;
  selected: PickerTarget | null;
};

let state: State = { arming: false, sticky: false, hover: null, selected: null };
const listeners = new Set<() => void>();

function set(p: Partial<State>) {
  state = { ...state, ...p };
  for (const l of listeners) l();
}

export const pickerStore = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  arm(sticky = false) {
    set({ arming: true, sticky });
  },
  disarm() {
    set({ arming: false, sticky: false, hover: null });
  },
  hover(t: PickerTarget | null) {
    const h = state.hover;
    if (t?.element === h?.element && t?.text === h?.text && t?.granularity === h?.granularity) return;
    set({ hover: t });
  },
  select(t: PickerTarget | null) {
    set({ selected: t, arming: false, sticky: false, hover: null });
  },
  clear() {
    set({ selected: null, hover: null, arming: false, sticky: false });
  },
};

export function usePicker() {
  return useSyncExternalStore(pickerStore.subscribe, pickerStore.get, pickerStore.get);
}

/** Resolve a DOM node to the nearest stamped source element. */
export function resolveTarget(el: Element | null): PickerTarget | null {
  let node = el?.closest<HTMLElement>("[data-ab]") ?? null;
  const frameOnly = !node;
  if (!node) {
    // Inside a block but on an unstamped element (e.g. a kit wrapper): target the block itself.
    const body = el?.closest<HTMLElement>(".frame-body");
    if (!body) return null;
    node = body;
  }
  const frame = node.closest<HTMLElement>("[data-ab-block]");
  const isNew = frame?.dataset.abBlock === "__new__";
  const stamp = frameOnly || isNew ? `${frame?.dataset.abPath ?? ""}:${isNew ? 0 : 1}` : (node.dataset.ab ?? "");
  const i = stamp.lastIndexOf(":");
  const path = stamp.slice(0, i);
  const line = Number(stamp.slice(i + 1));
  if (isNew) {
    return { path, line: 0, blockId: undefined, blockTitle: "New block", tag: "wall", text: undefined, rect: frame!.getBoundingClientRect(), element: frame!, granularity: "block" };
  }
  const text = (node.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  return {
    path,
    line,
    blockId: frame?.dataset.abBlock,
    blockTitle: frame?.querySelector(".placard .text-ink-2")?.textContent ?? undefined,
    tag: node.tagName.toLowerCase(),
    text: text || undefined,
    rect: node.getBoundingClientRect(),
    element: node,
    granularity: frameOnly ? "block" : "element",
  };
}

/**
 * If the pointer sits on a word inside `el`, return that word and its box.
 * Uses caret hit-testing (Chrome/Firefox: caretPositionFromPoint; Safari: caretRangeFromPoint).
 */
export function wordAtPoint(el: HTMLElement, x: number, y: number): { word: string; rect: DOMRect } | null {
  type CaretPos = { offsetNode: Node; offset: number };
  const d = document as Document & { caretPositionFromPoint?: (x: number, y: number) => CaretPos | null; caretRangeFromPoint?: (x: number, y: number) => Range | null };
  let node: Node | null = null;
  let offset = 0;
  if (d.caretPositionFromPoint) {
    const p = d.caretPositionFromPoint(x, y);
    if (p) {
      node = p.offsetNode;
      offset = p.offset;
    }
  } else if (d.caretRangeFromPoint) {
    const r = d.caretRangeFromPoint(x, y);
    if (r) {
      node = r.startContainer;
      offset = r.startOffset;
    }
  }
  if (!node || node.nodeType !== Node.TEXT_NODE || !el.contains(node)) return null;
  const text = node.textContent ?? "";
  if (!text.trim()) return null;
  const isWord = (c: string) => /[\p{L}\p{N}'’-]/u.test(c);
  let a = Math.min(offset, text.length);
  let b = a;
  if (a > 0 && !isWord(text[a] ?? "") && isWord(text[a - 1] ?? "")) a--;
  while (a > 0 && isWord(text[a - 1] ?? "")) a--;
  b = a;
  while (b < text.length && isWord(text[b] ?? "")) b++;
  if (b <= a) return null;
  const range = document.createRange();
  range.setStart(node, a);
  range.setEnd(node, b);
  const rect = range.getBoundingClientRect();
  if (rect.width === 0 || x < rect.left - 2 || x > rect.right + 2 || y < rect.top - 2 || y > rect.bottom + 2) return null;
  return { word: text.slice(a, b), rect };
}
