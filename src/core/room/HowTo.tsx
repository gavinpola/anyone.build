import { useEffect, useRef, useState } from "react";
import { CircleHelp } from "lucide-react";
import { helpStore } from "@/core/help/helpStore";
import { usePicker } from "@/core/picker/pickerStore";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform + navigator.userAgent);

/**
 * The "?" in the corner: one small card that says how to use the canvas. Not a dialog (the header's
 * "How this works" panel is the long version, reachable from here). Closes on Escape, on a press
 * outside, and the moment you start pointing.
 */
export function HowTo() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const { arming } = usePicker();
  const [wasArming, setWasArming] = useState(arming);
  if (arming !== wasArming) {
    setWasArming(arming);
    if (arming) setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [open]);
  return (
    <div ref={ref} className="canvas-howto" data-canvas-ui>
      {open ? (
        <div id="canvas-howto" className="canvas-howto-pop" data-canvas-howto>
          <p className="placard smallcaps">How to use the canvas</p>
          <p className="mt-2">
            Hold <kbd>⇧</kbd>
            <kbd>{isMac ? "⌘" : "Ctrl"}</kbd> and point at anything, then say what should change. Or press <strong>Change something</strong>.
          </p>
          <p className="mt-2">Drag out a space to work on that space. Drag an object to move it.</p>
          <p className="mt-2">
            On a phone: tap <strong>Change</strong>, then tap.
          </p>
          <button
            type="button"
            className="mt-3 text-[13px] font-medium text-accent hover:underline"
            onClick={() => {
              setOpen(false);
              helpStore.open();
            }}
          >
            The full story
          </button>
        </div>
      ) : null}
      <button
        type="button"
        className="canvas-howto-btn"
        aria-label="How to use the canvas"
        title="How to use the canvas"
        aria-expanded={open}
        aria-controls="canvas-howto"
        onClick={() => setOpen((o) => !o)}
      >
        <CircleHelp size={16} />
      </button>
    </div>
  );
}
