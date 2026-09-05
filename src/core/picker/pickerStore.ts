import { useSyncExternalStore } from "react";
import type { Target } from "@/core/lib/types";

export type PickerTarget = Target & {
  rect: DOMRect;
  element: HTMLElement;
  point?: { x: number; y: number };
  /** "word" when the pointer is over a specific word of text inside the element */
  granularity?: "element" | "word" | "block";
  /** a prefilled ask (e.g. from dragging a block): the person can edit it before sending */
  draft?: string;
  /** who last touched the block and how long it has left ("pinned", "faded", or days) */
  facts?: { by: string | null; left: string | null; when: number | null };
};

/** The facts a block section carries as data attributes (Room.tsx writes them). */
export function factsOf(frame: HTMLElement | null | undefined): PickerTarget["facts"] | undefined {
  if (!frame?.dataset.abBlock || frame.dataset.abBlock === "__new__" || frame.dataset.abBlock === "__canvas__") return undefined;
  const by = frame.dataset.abBy ?? null;
  const left = frame.dataset.abLeft ?? null;
  const when = frame.dataset.abWhen ? Number(frame.dataset.abWhen) : null;
  if (by == null && left == null && when == null) return undefined;
  return { by, left, when: Number.isFinite(when as number) ? when : null };
}

type State = {
  /** true while the modifier chord is held or "pick mode" was toggled on */
  arming: boolean;
  /** true when arming was toggled via the UI button (sticky until a pick or Esc) */
  sticky: boolean;
  hover: PickerTarget | null;
  selected: PickerTarget | null;
};

let state: State = { arming: false, sticky: false, hover: null, selected: null };
// The canvas handles some pointer gestures itself (a drag over a space, dragging a block); the click that
// ends such a gesture must not also be treated as a pick.
let suppressUntil = 0;
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
    const sameRect = !!t && !!h && t.rect.top === h.rect.top && t.rect.left === h.rect.left && t.rect.width === h.rect.width && t.rect.height === h.rect.height;
    if (t?.element === h?.element && t?.text === h?.text && t?.granularity === h?.granularity && sameRect) return;
    set({ hover: t });
  },
  select(t: PickerTarget | null) {
    set({ selected: t, arming: false, sticky: false, hover: null });
  },
  clear() {
    set({ selected: null, hover: null, arming: false, sticky: false });
  },
  /** Ignore the next click (within 400ms): a gesture already decided what happens. */
  suppressClick() {
    suppressUntil = Date.now() + 400;
  },
  clickSuppressed() {
    return Date.now() < suppressUntil;
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
  if (frame?.dataset.abBlock === "__canvas__" && node.closest("[data-ab-block]") === frame) {
    // a click in the gaps between blocks: the wall itself (its background, spacing, shapes, flow)
    return { path: frame.dataset.abPath ?? "src/rooms/main/canvas.ts", line: 1, blockId: "__canvas__", blockTitle: "The wall itself", tag: "canvas", text: undefined, rect: frame.getBoundingClientRect(), element: frame, granularity: "block" };
  }
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
    facts: factsOf(frame),
  };
}

/**
 * If the pointer sits on a word inside `el`, return that word and its box.
 * Uses caret hit-testing (Chrome/Firefox: caretPositionFromPoint; Safari: caretRangeFromPoint).
 */
export function wordAtPoint(el: HTMLElement, x: number, y: number): { word: string; rect: DOMRect; punct?: boolean } | null {
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
  const isPunct = (c: string) => c !== "" && !/\s/u.test(c) && !isWord(c);
  const rectOf = (from: number, to: number) => {
    const range = document.createRange();
    range.setStart(node!, from);
    range.setEnd(node!, to);
    const r = range.getBoundingClientRect();
    return r.width === 0 || x < r.left - 2 || x > r.right + 2 || y < r.top - 2 || y > r.bottom + 2 ? null : r;
  };

  // Punctuation is its own target: a period, a comma, an "!", or a run of the same mark ("…", "!!").
  // The caret lands on either side of a mark, so try the char at the offset and the one before it.
  for (const c of [Math.min(offset, text.length - 1), offset - 1]) {
    if (c < 0 || c >= text.length) continue;
    const ch = text[c] ?? "";
    if (!isPunct(ch)) continue;
    let pa = c;
    let pb = c + 1;
    while (pa > 0 && text[pa - 1] === ch) pa--;
    while (pb < text.length && text[pb] === ch) pb++;
    const r = rectOf(pa, pb);
    if (r) return { word: text.slice(pa, pb), rect: r, punct: true };
  }

  let a = Math.min(offset, text.length);
  let b = a;
  if (a > 0 && !isWord(text[a] ?? "") && isWord(text[a - 1] ?? "")) a--;
  while (a > 0 && isWord(text[a - 1] ?? "")) a--;
  b = a;
  while (b < text.length && isWord(text[b] ?? "")) b++;
  if (b <= a) return null;
  const rect = rectOf(a, b);
  if (!rect) return null;
  return { word: text.slice(a, b), rect };
}
