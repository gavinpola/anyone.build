import { useEffect, useLayoutEffect, useState, type RefObject } from "react";
import type { Body } from "./hang";

/**
 * The liquid layer: one body per block, painted under the content in a single filtered layer so bodies
 * that touch fuse like drops of paint (an SVG "goo" filter: blur, then crush the alpha). The content sits
 * above, unfiltered, so text stays crisp. Bodies are measured from the blocks' own boxes, so any layout
 * (grid, organic, free placement) gets a matching liquid underneath; they follow resizes and reflows.
 */
export type LiquidBody = { id: string; body: Body; tilt: number };

type Box = { id: string; x: number; y: number; w: number; h: number };

export function LiquidLayer({ wallRef, bodies, goo, morph }: { wallRef: RefObject<HTMLDivElement | null>; bodies: LiquidBody[]; goo: boolean; morph: boolean }) {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const measure = () => {
    const wall = wallRef.current;
    if (!wall) return;
    const wr = wall.getBoundingClientRect();
    const z = wall.offsetWidth ? wr.width / wall.offsetWidth : 1; // the world may be zoomed; bodies live in world units
    const next: Box[] = [];
    for (const b of bodies) {
      const el = wall.querySelector<HTMLElement>(`[data-ab-block="${CSS.escape(b.id)}"]`);
      if (!el) continue;
      // hug the content, not the cell: the union of what's actually inside (text lines, a canvas, buttons)
      const inner = el.querySelector<HTMLElement>(".frame-body") ?? el;
      const range = document.createRange();
      range.selectNodeContents(inner);
      const cr = range.getBoundingClientRect();
      const outer = el.getBoundingClientRect();
      const r = cr.width > 24 && cr.height > 12 ? cr : outer;
      const pad = 18 * z;
      const x = Math.max(outer.left, r.left - pad);
      const y = Math.max(outer.top, r.top - pad);
      const right = Math.min(outer.right, r.right + pad);
      const bottom = Math.min(outer.bottom, r.bottom + pad);
      next.push({ id: b.id, x: (x - wr.left) / z, y: (y - wr.top) / z, w: Math.max(40, (right - x) / z), h: Math.max(28, (bottom - y) / z) });
    }
    setBoxes((prev) => (prev.length === next.length && prev.every((p, i) => p.id === next[i]!.id && Math.abs(p.x - next[i]!.x) < 0.5 && Math.abs(p.y - next[i]!.y) < 0.5 && Math.abs(p.w - next[i]!.w) < 0.5 && Math.abs(p.h - next[i]!.h) < 0.5) ? prev : next));
  };
  useLayoutEffect(measure);
  useEffect(() => {
    const wall = wallRef.current;
    if (!wall || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(wall);
    for (const el of Array.from(wall.querySelectorAll<HTMLElement>("[data-ab-block]"))) ro.observe(el);
    window.addEventListener("resize", measure);
    const t = setInterval(measure, 1500); // fonts, images, and blocks that grow on their own
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodies.map((b) => b.id).join("|")]);

  const byId = new Map(bodies.map((b) => [b.id, b]));
  const reach = 14; // how far a body spills past its block, px
  return (
    <div className={goo ? "liquid liquid-goo" : "liquid"} aria-hidden data-liquid={boxes.length}>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
        <defs>
          <filter id="ab-goo" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>
      {boxes.map((bx) => {
        const b = byId.get(bx.id);
        if (!b) return null;
        return (
          <div
            key={bx.id}
            className={morph ? "body body-morph" : "body"}
            style={
              {
                left: bx.x - reach,
                top: bx.y - reach,
                width: bx.w + reach * 2,
                height: bx.h + reach * 2,
                "--body-r": b.body.radius,
                "--body-r2": b.body.radius2,
                "--body-clip": b.body.clip,
                "--body-clip2": b.body.clip2,
                background: b.body.tint,
                mixBlendMode: b.body.blend,
                transform: `rotate(${b.tilt}deg)`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
