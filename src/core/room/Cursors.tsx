import { useEffect, useRef, useState, type RefObject } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { hasConvex } from "@/core/lib/providers";
import { tabSessionId } from "@/core/lib/session";
import { useLiveStats } from "@/core/lib/useLiveStats";

const THROTTLE_MS = 120;
const MIN_PEERS = 2; // don't broadcast when you're alone
const MAX_PEERS = 30; // above this, cursors turn off (keeps the shared cost bounded)

function hueFrom(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

/** Live cursors over the wall. Positions are fractions of the room box, so they map across screens. */
export function Cursors({ roomId, boxRef }: { roomId: string; boxRef: RefObject<HTMLElement | null> }) {
  const stats = useLiveStats();
  const on = hasConvex && stats.online >= MIN_PEERS && stats.online <= MAX_PEERS;
  if (!on) return null;
  return <CursorsLive roomId={roomId} boxRef={boxRef} />;
}

function CursorsLive({ roomId, boxRef }: { roomId: string; boxRef: RefObject<HTMLElement | null> }) {
  const session = tabSessionId();
  const hue = hueFrom(session);
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
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      if (x < -0.05 || x > 1.05 || y < -0.05 || y > 1.05) return; // only over the wall
      last.current = now;
      void move({ roomId, sessionId: session, x, y, hue }).catch(() => {});
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
  }, [boxRef, move, leave, roomId, session, hue]);

  if (!box) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden" aria-hidden>
      {peers.map((p) => (
        <span
          key={p.id}
          className="absolute -ml-1 -mt-1 transition-[left,top] duration-100 ease-linear"
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
        >
          <svg width="18" height="18" viewBox="0 0 16 16" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,.25))" }}>
            <path d="M1 1 L1 12 L4.2 9.2 L6.4 14 L8.3 13.2 L6.1 8.5 L10 8.5 Z" fill={`hsl(${p.hue} 70% 45%)`} stroke="white" strokeWidth="1" strokeLinejoin="round" />
          </svg>
        </span>
      ))}
    </div>
  );
}
