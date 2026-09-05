import { useEffect, useRef, useState, type RefObject } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { hasConvex } from "@/core/lib/providers";
import { tabSessionId } from "@/core/lib/session";
import { useLiveStats } from "@/core/lib/useLiveStats";
import { useViewer } from "@/core/auth/useViewer";
import { useNow } from "@/core/lib/useNow";

const THROTTLE_MS = 120;
const MIN_PEERS = 2; // don't broadcast when you're alone
const MAX_PEERS = 30; // above this, cursors turn off (keeps the shared cost bounded)

function hueFrom(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

/** Live cursors over the wall. Positions are fractions of the world box (a little beyond it is fine: the ground around the wall is part of the room), so they map across screens and zooms. */
export function Cursors({ roomId, boxRef, scale = 1 }: { roomId: string; boxRef: RefObject<HTMLElement | null>; scale?: number }) {
  const stats = useLiveStats();
  const on = hasConvex && stats.online >= MIN_PEERS && stats.online <= MAX_PEERS;
  if (!on) return null;
  return <CursorsLive roomId={roomId} boxRef={boxRef} scale={scale} />;
}

function CursorsLive({ roomId, boxRef, scale }: { roomId: string; boxRef: RefObject<HTMLElement | null>; scale: number }) {
  const session = tabSessionId();
  const hue = hueFrom(session);
  const viewer = useViewer();
  const name = viewer.signedIn ? viewer.handle : viewer.handle.replace("guest-", "guest · ");
  const peers = useQuery(api.cursors.active, { roomId, sessionId: session }) ?? [];
  const move = useMutation(api.cursors.move);
  const leave = useMutation(api.cursors.leave);
  const last = useRef(0);
  const [box, setBox] = useState<DOMRect | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setBox(el.getBoundingClientRect());
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("scroll", measure, { passive: true });

    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - last.current < THROTTLE_MS) return;
      const r = el.getBoundingClientRect();
      // the dark beyond the world is not the wall: a pointer out there shows at the nearest edge
      const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
      last.current = now;
      void move({ roomId, sessionId: session, x, y, hue, name }).catch(() => {});
    };
    const onLeave = () => void leave({ roomId, sessionId: session }).catch(() => {});
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", () => document.hidden && onLeave());
    window.addEventListener("pagehide", onLeave);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", measure);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pagehide", onLeave);
      onLeave();
    };
  }, [boxRef, move, leave, roomId, session, hue, name]);

  // a cursor that stopped moving fades out on this side too (the query only re-runs when someone moves)
  const now = useNow(2000);
  const fresh = peers.filter((p) => now - p.at < 8_000);
  if (!box) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-visible" aria-hidden data-cursors={fresh.length}>
      {fresh.map((p) => (
        <span
          key={p.id}
          className="absolute -ml-1 -mt-1 transition-[left,top] duration-100 ease-linear"
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, transform: `scale(${scale})`, transformOrigin: "4px 4px" }}
        >
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
