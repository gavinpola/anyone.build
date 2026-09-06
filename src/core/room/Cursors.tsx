import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { hasConvex, useQuerySafe } from "@/core/lib/providers";
import { tabSessionId } from "@/core/lib/session";
import { useLiveStats } from "@/core/lib/useLiveStats";
import { useViewer } from "@/core/auth/useViewer";
import { useNow } from "@/core/lib/useNow";
import { TILE_H, TILE_W } from "./canvas";

const THROTTLE_MS = 200; // each move fans out to every viewer; five a second is plenty
const MIN_PEERS = 2; // don't broadcast when you're alone
const MAX_PEERS = 30; // above this, cursors turn off (keeps the shared cost bounded)

function hueFrom(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

/**
 * Live cursors over the world. Positions travel in tiles (the world's unit, fractional), so everyone
 * sees a pointer over the same object whatever their screen shows. `worldPoint` turns a client point
 * into world px with the room's camera.
 */
export function Cursors({ roomId, worldPoint }: { roomId: string; worldPoint: (e: { clientX: number; clientY: number }) => { x: number; y: number } }) {
  const stats = useLiveStats();
  const on = hasConvex && stats.online >= MIN_PEERS && stats.online <= MAX_PEERS;
  if (!on) return null;
  return <CursorsLive roomId={roomId} worldPoint={worldPoint} />;
}

function CursorsLive({ roomId, worldPoint }: { roomId: string; worldPoint: (e: { clientX: number; clientY: number }) => { x: number; y: number } }) {
  const session = tabSessionId();
  const hue = hueFrom(session);
  const viewer = useViewer();
  const name = viewer.signedIn ? viewer.handle : viewer.handle.replace("guest-", "guest · ");
  const peers = useQuerySafe(api.cursors.active, { roomId, sessionId: session }) ?? [];
  const move = useMutation(api.cursors.move);
  const leave = useMutation(api.cursors.leave);
  const last = useRef(0);
  const wp = useRef(worldPoint);
  useEffect(() => {
    wp.current = worldPoint;
  }, [worldPoint]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - last.current < THROTTLE_MS) return;
      const p = wp.current(e);
      last.current = now;
      void move({ roomId, sessionId: session, x: p.x / TILE_W, y: p.y / TILE_H, hue, name }).catch(() => {});
    };
    const onLeave = () => void leave({ roomId, sessionId: session }).catch(() => {});
    const onVis = () => document.hidden && onLeave();
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onLeave);
      onLeave();
    };
  }, [move, leave, roomId, session, hue, name]);

  // a cursor that stopped moving fades out on this side too (the query only re-runs when someone moves)
  const now = useNow(2000);
  const fresh = peers.filter((p) => now - p.at < 8_000);
  return (
    <div className="pointer-events-none absolute left-0 top-0 z-30 overflow-visible" aria-hidden data-cursors={fresh.length}>
      {fresh.map((p) => (
        <span key={p.id} className="absolute -ml-1 -mt-1 transition-[left,top] duration-100 ease-linear" style={{ left: p.x * TILE_W, top: p.y * TILE_H }}>
          <svg width="18" height="18" viewBox="0 0 16 16" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,.25))" }}>
            <path d="M1 1 L1 12 L4.2 9.2 L6.4 14 L8.3 13.2 L6.1 8.5 L10 8.5 Z" fill={`hsl(${p.hue} 70% 45%)`} stroke="white" strokeWidth="1" strokeLinejoin="round" />
          </svg>
          {p.name ? (
            <span className="cursor-label" style={{ background: `hsl(${p.hue} 70% 45%)` }}>
              {p.name}
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}
