import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { TileRect } from "./canvas";
import { track } from "@/core/lib/analytics";

const DAY = 86_400_000;

/**
 * The object sheet: tap an object's label (or long-press the object) and this says who made it and how
 * long it has left, and offers Change and Move. On a phone it is a sheet at the bottom; on a laptop a
 * small card under the label. Closes on Escape, a press outside, or when you start pointing.
 */
export function ObjectSheet({
  id,
  title,
  facts,
  tiles,
  compact,
  onChange,
  onMove,
  onClose,
}: {
  id: string;
  title: string;
  facts: { by: string | null; left: number | null; faded: boolean; lastAt: number | null; changes: number };
  tiles: TileRect | null;
  compact: boolean;
  onChange: (point: { x: number; y: number }) => void;
  onMove: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  // under the label that opened it (the sheet is keyed by block, so this runs once per opening)
  const [pos] = useState<{ left: number; top: number } | null>(() => {
    if (compact) return null;
    const label = document.querySelector<HTMLElement>(`[data-object-label="${CSS.escape(id)}"]`);
    const r = label?.getBoundingClientRect();
    const w = 300;
    if (!r) return { left: Math.max(8, window.innerWidth / 2 - w / 2), top: 120 };
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    const top = r.bottom + 8 + 190 > window.innerHeight ? Math.max(8, r.top - 8 - 190) : r.bottom + 8;
    return { left, top };
  });
  // the listeners live for the sheet's whole life: re-registering them mid-keypress (the picker's own Escape handler
  // re-renders the room first) would drop the very key they are waiting for
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    track("sheet_open", { block: id });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
    };
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close.current();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [id]);
  const who = facts.by ? `@${facts.by.replace(/^guest[- ·]*/, "guest · ")}` : "someone";
  const life = facts.left == null ? "stays as long as the wall does" : facts.faded ? "faded · touch it to bring it back" : facts.left < DAY ? "fades today unless touched" : `${Math.ceil(facts.left / DAY)} days left`;
  return createPortal(
    <div ref={ref} className={"object-sheet" + (compact ? " is-sheet" : "")} style={compact || !pos ? undefined : { left: pos.left, top: pos.top }} role="dialog" aria-label={`${title}: who made it, change it, or move it`} data-object-sheet={id}>
      <div className="object-sheet-head">
        <div className="min-w-0">
          <p className="object-sheet-title">{title}</p>
          <p className="object-sheet-facts" data-sheet-facts>
            {who} made this · {life}
            {tiles ? ` · tile ${tiles.x},${tiles.y} · ${tiles.w}×${tiles.h}` : ""}
          </p>
        </div>
        <button type="button" className="object-sheet-x" onClick={onClose} aria-label="Close">
          <X size={14} />
        </button>
      </div>
      <div className="object-sheet-actions">
        <button type="button" className="object-sheet-cta" onClick={(e) => onChange({ x: e.clientX, y: e.clientY })}>
          Change
        </button>
        <button type="button" className="object-sheet-btn" onClick={onMove}>
          Move
        </button>
      </div>
    </div>,
    document.body,
  );
}
