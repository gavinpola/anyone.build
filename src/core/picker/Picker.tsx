import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { pickerStore, resolveTarget, usePicker, wordAtPoint, type PickerTarget } from "./pickerStore";

/** Element under the pointer, refined to a single word when the pointer is on text. */
function targetAt(x: number, y: number): PickerTarget | null {
  const el = document.elementFromPoint(x, y);
  const t = resolveTarget(el);
  if (!t || t.granularity === "block") return t;
  const w = wordAtPoint(t.element, x, y);
  if (w && (w.punct || w.word.length >= 2) && (t.element.textContent ?? "").trim().length > w.word.length) {
    return { ...t, rect: w.rect, text: w.word, granularity: "word" };
  }
  return t;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * The signature interaction. Hold ⇧⌘ (⇧Ctrl elsewhere) or toggle pick mode, point at
 * anything on the wall, click. Long-press on touch devices.
 */
export function Picker() {
  const { arming, hover, selected } = usePicker();
  const longPress = useRef<number | null>(null);

  // Keyboard chord
  useEffect(() => {
    const chordHeld = (e: KeyboardEvent) => e.shiftKey && (isMac ? e.metaKey : e.ctrlKey);
    const onDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        pickerStore.clear();
        return;
      }
      if (chordHeld(e) && !pickerStore.get().selected) pickerStore.arm(false);
    };
    const onUp = (e: KeyboardEvent) => {
      const s = pickerStore.get();
      if (s.sticky) return;
      if (!chordHeld(e) && s.arming) pickerStore.disarm();
    };
    const onBlur = () => {
      if (!pickerStore.get().sticky) pickerStore.disarm();
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // Pointer tracking while armed
  useEffect(() => {
    document.body.toggleAttribute("data-picking", arming);
    if (!arming) return;
    const onMove = (e: PointerEvent) => {
      pickerStore.hover(targetAt(e.clientX, e.clientY));
    };
    const onClick = (e: MouseEvent) => {
      if (pickerStore.clickSuppressed()) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const t = targetAt(e.clientX, e.clientY);
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      pickerStore.select({ ...t, point: { x: e.clientX, y: e.clientY } });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " ") e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    const onScroll = () => {
      const h = pickerStore.get().hover;
      if (h) pickerStore.hover({ ...h, rect: h.element.getBoundingClientRect() });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("click", onClick, true);
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("keydown", onKey);
      document.body.removeAttribute("data-picking");
    };
  }, [arming]);

  // Long-press on touch
  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch || e.touches.length > 1) return;
      const x = touch.clientX;
      const y = touch.clientY;
      longPress.current = window.setTimeout(() => {
        const t = resolveTarget(document.elementFromPoint(x, y));
        if (t) {
          navigator.vibrate?.(10);
          pickerStore.select({ ...t, point: { x, y } });
        }
      }, 480);
    };
    const cancel = () => {
      if (longPress.current) window.clearTimeout(longPress.current);
      longPress.current = null;
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", cancel, { passive: true });
    window.addEventListener("touchend", cancel);
    window.addEventListener("touchcancel", cancel);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", cancel);
      window.removeEventListener("touchend", cancel);
      window.removeEventListener("touchcancel", cancel);
    };
  }, []);

  const t = selected ?? hover;
  if (!t) return null;
  const r = t.rect;
  const pad = t.granularity === "word" ? 3 : 0;
  const placardTop = r.bottom + 10 + 30 > window.innerHeight ? r.top - 32 : r.bottom + 10;
  return createPortal(
    <>
      <motion.div
        key="outline"
        className={"picker-outline" + (selected ? " is-selected" : "")}
        initial={false}
        animate={{ top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2, opacity: 1 }}
        transition={{ type: "spring", stiffness: 900, damping: 48, mass: 0.45 }}
      >
        <i />
      </motion.div>
      {!selected ? (
        <div className="picker-placard" style={{ top: placardTop, left: Math.max(8, Math.min(r.left, window.innerWidth - 380)) }}>
          <span className="text-accent">{t.blockTitle ?? t.blockId ?? "wall"}</span>
          <span className="opacity-60"> · </span>
          <span>{t.tag === "region" ? "this space" : t.line === 0 ? "add something here" : t.granularity === "word" ? `“${t.text}”` : `<${t.tag}>`}</span>
          {t.line !== 0 ? (
            <>
              <span className="opacity-60"> · </span>
              <span className="opacity-80">{t.path.replace("src/rooms/main/", "")}:{t.line}</span>
            </>
          ) : null}
          {t.facts ? (
            <span className="block opacity-80" data-placard-facts>
              {t.facts.by ? `@${t.facts.by.replace(/^guest[- ·]*/, "guest · ")}` : "someone"}
              {t.facts.left === "pinned" ? " · pinned" : t.facts.left === "faded" ? " · faded, touch to revive" : t.facts.left != null ? ` · ${t.facts.left}d left` : ""}
            </span>
          ) : null}
        </div>
      ) : null}
    </>,
    document.body,
  );
}
