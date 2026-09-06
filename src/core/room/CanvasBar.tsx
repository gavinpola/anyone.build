import { PickButton } from "@/core/picker/PickButton";
import { LiveButton } from "@/core/feed/LiveButton";
import type { Tile } from "./canvas";

/**
 * The bottom bar: where you are (a tile), "Change something" (pick mode), Live (the feed drawer), and a
 * one-line toast for what just shipped (tap it to go there) or what fades today. No zoom: the world is
 * always 100%. Nothing else floats over the world but the map and the "?", and those step aside the
 * moment you point.
 */
export function CanvasBar({ tile, toast, onToast, compact = false }: { tile: Tile; toast: string | null; onToast?: (() => void) | undefined; compact?: boolean }) {
  return (
    <div className="canvas-bar" data-canvas-bar role="toolbar" aria-label="Canvas">
      {!compact ? (
        <>
          <span className="canvas-tile" data-tile-readout aria-label={`You are at tile ${tile.x},${tile.y}`}>
            tile <span className="n">{tile.x},{tile.y}</span>
          </span>
          <span className="canvas-bar-sep" />
        </>
      ) : null}
      <PickButton className="canvas-bar-cta whitespace-nowrap" label="Change something" />
      <LiveButton className="canvas-bar-live" />
      {toast ? (
        onToast ? (
          <button type="button" className="canvas-toast" data-toast onClick={onToast} title="Go there">
            <span className="live-dot" aria-hidden />
            <span className="truncate">{toast}</span>
            <span className="go" aria-hidden>→</span>
          </button>
        ) : (
          <span className="canvas-toast" data-toast>
            <span className="live-dot" aria-hidden />
            <span className="truncate">{toast}</span>
          </span>
        )
      ) : null}
    </div>
  );
}
