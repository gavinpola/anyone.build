import { Minus, Plus, Maximize2, Brush, StickyNote } from "lucide-react";
import { PickButton } from "@/core/picker/PickButton";

/**
 * The bottom bar: zoom, fit, a quick note, "describe a thing" (pick mode), the door to the wall's own
 * file, and a one-line toast for what just shipped or what fades today.
 */
export function CanvasBar({ zoom, fit, onZoom, onFit, onWall, onNote, toast, compact = false }: { zoom: number; fit: number; onZoom: (z: number) => void; onFit: () => void; onWall: (rect: DOMRect) => void; onNote: (rect: DOMRect) => void; toast: string | null; compact?: boolean }) {
  const pct = Math.round(zoom * 100);
  const btn = "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-[12px] font-medium text-ink-2 hover:bg-paper-2 hover:text-ink disabled:opacity-40";
  return (
    <div className="canvas-bar" data-canvas-bar role="toolbar" aria-label="Canvas">
      <button type="button" className={btn} onClick={() => onZoom(zoom / 1.25)} aria-label="Zoom out" disabled={zoom <= fit + 0.001}>
        <Minus size={13} />
      </button>
      <button type="button" className={btn + " font-mono tabular-nums"} onClick={() => onZoom(zoom < 0.99 ? 1 : fit)} title="Toggle 100% / fit" aria-label={`Zoom ${pct}%`}>
        {pct}%
      </button>
      <button type="button" className={btn} onClick={() => onZoom(zoom * 1.25)} aria-label="Zoom in">
        <Plus size={13} />
      </button>
      <button type="button" className={btn} onClick={onFit} aria-label="Fit the whole wall" title="Fit">
        <Maximize2 size={13} />
      </button>
      <span className="canvas-bar-sep" />
      <button type="button" className={btn + " gap-1.5 font-mono uppercase tracking-[0.08em]"} onClick={(e) => onNote((e.currentTarget as HTMLElement).getBoundingClientRect())} title="A quick note">
        <StickyNote size={13} />
        <span className="bar-text">note</span>
      </button>
      <button type="button" className={btn + " gap-1.5 font-mono uppercase tracking-[0.08em]"} onClick={(e) => onWall((e.currentTarget as HTMLElement).getBoundingClientRect())} title="Change the wall itself: its ground, spacing, skin, decay">
        <Brush size={13} />
        <span className="bar-text">the wall</span>
      </button>
      <span className="canvas-bar-sep" />
      <PickButton className="canvas-bar-cta whitespace-nowrap" label={compact ? "Change" : "Change something"} />
      {toast ? (
        <span className="canvas-toast" data-toast>
          <span className="live-dot" aria-hidden />
          <span className="truncate">{toast}</span>
        </span>
      ) : null}
    </div>
  );
}
