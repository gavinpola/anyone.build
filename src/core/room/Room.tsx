import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import type { BlockModule } from "@/kit";
import { PageLink } from "@/kit/PageLink";
import { RoomContext } from "@/kit/room-context";
import { api } from "../../../convex/_generated/api";
import { hasConvex, useQuerySafe } from "@/core/lib/providers";
import { tabSessionId } from "@/core/lib/session";
import { useNow } from "@/core/lib/useNow";
import { useRequests } from "@/core/lib/useRequests";
import { pagesFor } from "./pages";
import { cn } from "@/core/lib/cn";
import { BlockBoundary } from "@/core/lib/BlockBoundary";
import { room } from "@/rooms/main/room";
import { canvas } from "@/rooms/main/canvas";
import { Cursors } from "./Cursors";
import { hang, shapeStyle, wallStyle } from "./hang";
import { LiquidLayer } from "./LiquidLayer";
import { CanvasBar } from "./CanvasBar";
import { Pins } from "./Pins";
import { Minimap } from "./Minimap";
import { HowTo } from "./HowTo";
import { Heat } from "./Heat";
import { useTouch } from "./useTouch";
import { clampPan, clampZoom, fitZoom, lifeLeft, packBlocks, parsePoint, parseRegion, pointText, regionText, toWorld, widthFor, worldSize, zoomAround, type Pan, type Rect } from "./canvas";
import { pickerStore, resolveTarget } from "@/core/picker/pickerStore";
import { loadView, saveView } from "@/core/lib/view";

// Every file in src/rooms/main/blocks is a block. Adding one never touches another file.
const modules = import.meta.glob<BlockModule>("/src/rooms/main/blocks/*.tsx", {
  eager: true,
});
// Dev/e2e only: hang the example blocks so every picker granularity can be exercised on a fresh clone.
const examples: Record<string, BlockModule> =
  import.meta.env.DEV && import.meta.env.VITE_E2E_BLOCKS === "1"
    ? import.meta.glob<BlockModule>("/docs/examples/blocks/*.tsx", {
        eager: true,
      })
    : {};

export const blocks = Object.entries({ ...examples, ...modules })
  .map(([path, mod]) => ({
    path: path.slice(1),
    meta: mod.block,
    Component: mod.default,
  }))
  .filter((b) => b.meta && b.Component && !b.meta.removed) // removed: true = taken off the wall, file kept as history
  .sort(
    (a, b) => a.meta.order - b.meta.order || a.meta.id.localeCompare(b.meta.id),
  );

const NEW_BLOCK_PATH = `src/rooms/${room.id}/blocks/`;
const ADD_ZONE = 300; // the 'point here to add' band at the bottom, when there is room for it
/** Height the floating bar takes at the bottom of the viewport; the world fits above it. */
const BAR_INSET = 72; // px of always-empty canvas at the bottom: "point here to add something" (tall enough to point at when fitted)
const GAP = () => Math.max(0, Math.min(80, canvas.gap ?? 24));
const PAD = () => Math.max(0, Math.min(80, canvas.padding ?? 6)) + 80; // room for the constant-size labels above the first row (22px / zoom ≥ 0.3)
const IN_FLIGHT = new Set(["queued", "building", "validating", "reviewing", "preview", "merging"]);
const DAY = 86_400_000;

/** The wall: a bounded canvas you zoom and pan on desktop; the same blocks stacked on a phone. */
export function Room() {
  const [stacked, setStacked] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const f = () => setStacked(mq.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return stacked && canvas.mobile === "stack" ? <StackedRoom /> : <CanvasRoom compact={stacked} />;
}

function useHeights(wallRef: React.RefObject<HTMLDivElement | null>, ids: string) {
  const [heights, setHeights] = useState<Record<string, number>>({});
  useLayoutEffect(() => {
    const wall = wallRef.current;
    if (!wall) return;
    const read = () => {
      const next: Record<string, number> = {};
      for (const el of Array.from(wall.querySelectorAll<HTMLElement>("[data-ab-block]"))) {
        const id = el.dataset.abBlock!;
        if (id === "__new__") continue;
        next[id] = el.offsetHeight;
      }
      setHeights((prev) => {
        const keys = Object.keys(next);
        if (keys.length === Object.keys(prev).length && keys.every((k) => Math.abs((prev[k] ?? -1) - next[k]!) < 1)) return prev;
        return next;
      });
    };
    read();
    const ro = new ResizeObserver(read);
    for (const el of Array.from(wall.querySelectorAll<HTMLElement>("[data-ab-block]"))) ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);
  return heights;
}

/** Who made each block and when it last changed, plus its decay clock. */
function useBlockFacts() {
  const provenance = useQuerySafe(api.leaderboard.blockProvenance, hasConvex ? { roomId: room.id } : "skip") ?? {};
  const life = useQuerySafe(api.life.list, hasConvex ? { roomId: room.id } : "skip");
  const lifeBy = useMemo(() => new Map((life ?? []).map((l) => [l.blockId, l])), [life]);
  return { provenance, lifeBy };
}

type Gesture =
  | { kind: "pan"; startX: number; startY: number; pan: Pan; moved: boolean }
  | { kind: "marquee"; start: { x: number; y: number }; rect: Rect | null }
  | { kind: "block"; id: string; start: { x: number; y: number }; from: { x: number; y: number }; delta: { x: number; y: number }; moved: boolean };

function CanvasRoom({ compact }: { compact: boolean }) {
  const pages = pagesFor(room.id);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const wallRef = useRef<HTMLDivElement | null>(null);
  const world = worldSize(canvas);
  const gap = GAP();
  const pad = PAD();
  const now = useNow(30_000);
  const { provenance, lifeBy } = useBlockFacts();
  const requests = useRequests();
  const peersQ = useQuerySafe(api.cursors.active, hasConvex ? { roomId: room.id, sessionId: tabSessionId() } : "skip");
  const decayOn = Boolean(canvas.decay) && (canvas.decay as number) > 0;
  const skin = canvas.skin ?? "instrument";
  const showAll = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("all");

  // facts per block: who, when, how long left, faded, editing
  const facts = useMemo(() => {
    const editing = new Set(requests.filter((r) => IN_FLIGHT.has(r.status) && r.target.blockId).map((r) => r.target.blockId!));
    const out = new Map<string, { by: string | null; lastAt: number | null; changes: number; left: number | null; window: number; faded: boolean; editing: boolean; isNew: boolean }>();
    for (const b of blocks) {
      const p = provenance[b.meta.id];
      const l = lifeBy.get(b.meta.id);
      const { left, window } = lifeLeft({ decayDays: canvas.decay, pinned: b.meta.pinned, lastTouchedAt: l?.lastTouchedAt ?? null, fallback: p?.lastAt ?? now, now });
      const faded = Boolean(l?.fadedAt) || (left != null && left <= 0);
      out.set(b.meta.id, { by: p?.lastBy ?? p?.guestTag ?? null, lastAt: p?.lastAt ?? null, changes: p?.changes ?? 0, left, window, faded, editing: editing.has(b.meta.id), isNew: (p?.lastAt ?? 0) > now - DAY });
    }
    return out;
  }, [provenance, lifeBy, requests, now]);
  const visible = useMemo(() => blocks.filter((b) => showAll || !facts.get(b.meta.id)?.faded), [facts, showAll]);
  const ids = visible.map((b) => b.meta.id).join("|");
  const heights = useHeights(wallRef, ids);

  const hung = useMemo(() => visible.map((b) => ({ ...b, h: hang(b.meta, canvas) })), [visible]);
  const layout = useMemo(() => {
    const items = hung.map((b) => ({ id: b.meta.id, w: widthFor(b.meta, world, pad, gap), h: heights[b.meta.id] ?? 240, place: b.meta.place, order: b.meta.order }));
    return packBlocks(items, world, gap, pad, gap + 26); // labels sit above objects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hung, heights, world.w, world.h, gap, pad]);
  // the world never grows: its size is the wall's own (canvas.ts), so the map is always the same rectangle
  const worldH = world.h;
  const roomForAddZone = layout.bottom + 60 <= worldH - ADD_ZONE - pad;
  const at = useMemo(() => new Map(layout.placed.map((p) => [p.id, p])), [layout]);

  // viewport, zoom, pan
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [me, setMe] = useState<{ x: number; y: number } | null>(null);
  // a quiet refresh (a change just landed) comes back exactly where you were
  const [savedView] = useState(() => loadView(`${world.w}x${world.h}`));
  const [zoom, setZoom] = useState(savedView?.zoom ?? 1);
  const [pan, setPan] = useState<Pan>(savedView?.pan ?? { x: 0, y: 0 });
  const fit = fitZoom(vp, { w: world.w, h: worldH });
  const fitted = useRef(false);
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    // the bar floats over the bottom of the viewport; fit the world into the space above it
    const measure = () => setVp({ w: el.clientWidth, h: Math.max(0, el.clientHeight - BAR_INSET) });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (!vp.w || fitted.current) return;
    fitted.current = true;
    if (savedView) return; // already where you were
    // the one place the fit is set from a measurement: a layout effect after the first ResizeObserver read
    /* eslint-disable react-hooks/set-state-in-effect */
    setZoom(fit);
    setPan(clampPan({ x: 0, y: 0 }, fit, vp, { w: world.w, h: worldH }));
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vp.w]);
  useEffect(() => {
    if (!fitted.current) return;
    const t = setTimeout(() => saveView({ pan, zoom, world: `${world.w}x${world.h}` }), 250);
    return () => clearTimeout(t);
  }, [pan, zoom, world.w, world.h]);
  const applyZoom = useCallback(
    (next: number, around?: { x: number; y: number }) => {
      const z = clampZoom(next, fit);
      const centre = around ?? { x: vp.w / 2, y: vp.h / 2 };
      const p = zoomAround(centre, { pan, zoom }, z);
      setZoom(z);
      setPan(clampPan(p, z, vp, { w: world.w, h: worldH }));
    },
    [fit, pan, zoom, vp, world.w, worldH],
  );
  const goTo = useCallback(
    (wp: { x: number; y: number }, z?: number) => {
      const zz = clampZoom(z ?? Math.max(zoom, 0.8), fit);
      setZoom(zz);
      setPan(clampPan({ x: vp.w / 2 - wp.x * zz, y: vp.h / 2 - wp.y * zz }, zz, vp, { w: world.w, h: worldH }));
    },
    [zoom, fit, vp, world.w, worldH],
  );
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (pickerStore.get().selected) return; // a change is being proposed: the wall holds still under the composer
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        applyZoom(zoom * Math.exp(-e.deltaY * 0.0022), { x: e.clientX - r.left, y: e.clientY - r.top });
      } else {
        setPan((p) => clampPan({ x: p.x - e.deltaX, y: p.y - e.deltaY }, zoom, vp, { w: world.w, h: worldH }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [applyZoom, zoom, vp, world.w, worldH]);
  useTouch(wallRef, decayOn);

  // gestures: pan on empty space; in pick mode, drag over a space (marquee) or drag a block (a move proposal);
  // two fingers pinch to zoom (and pan with the midpoint)
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number; mid: { x: number; y: number }; pan: Pan } | null>(null);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const setG = (g: Gesture | null) => {
    gestureRef.current = g;
    setGesture(g);
  };
  const worldPoint = (e: { clientX: number; clientY: number }) => {
    const r = viewportRef.current!.getBoundingClientRect();
    return toWorld({ x: e.clientX, y: e.clientY }, r, pan, zoom);
  };
  // the dark beyond the world's edge is not the wall: nothing is pointed at there, and a drag clamps to the edge
  const insideWorld = (p: { x: number; y: number }) => p.x >= 0 && p.x <= world.w && p.y >= 0 && p.y <= worldH;
  const clampToWorld = (p: { x: number; y: number }) => ({ x: Math.max(0, Math.min(world.w, p.x)), y: Math.max(0, Math.min(worldH, p.y)) });
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 2) {
        const [a, b] = Array.from(pointers.current.values());
        const r = viewportRef.current!.getBoundingClientRect();
        pinch.current = { dist: Math.hypot(a!.x - b!.x, a!.y - b!.y), zoom, mid: { x: (a!.x + b!.x) / 2 - r.left, y: (a!.y + b!.y) / 2 - r.top }, pan };
        setG(null);
        return;
      }
    }
    if (e.button !== 0) return;
    if (pickerStore.get().selected) return; // proposing a change: no pan, no marquee, no drag until the composer closes
    const target = e.target as HTMLElement;
    if (target.closest("[data-canvas-bar], [data-minimap], [data-canvas-ui]")) return;
    const section = target.closest<HTMLElement>("[data-ab-block]");
    const inBlock = section && section.dataset.abBlock !== "__new__" && wallRef.current?.contains(section);
    const picking = pickerStore.get().arming;
    if (picking) {
      if (inBlock) {
        const p = at.get(section.dataset.abBlock!);
        if (!p) return;
        setG({ kind: "block", id: section.dataset.abBlock!, start: worldPoint(e), from: { x: p.x, y: p.y }, delta: { x: 0, y: 0 }, moved: false });
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } else if (!section && picking) {
        if (!insideWorld(worldPoint(e))) return; // off the map: nothing to point at
        setG({ kind: "marquee", start: worldPoint(e), rect: null });
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
      return;
    }
    if (!section) {
      setG({ kind: "pan", startX: e.clientX, startY: e.clientY, pan, moved: false });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === "touch" && pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pz = pinch.current;
      if (pz && pointers.current.size >= 2) {
        const [a, b] = Array.from(pointers.current.values());
        const r = viewportRef.current!.getBoundingClientRect();
        const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        const mid = { x: (a!.x + b!.x) / 2 - r.left, y: (a!.y + b!.y) / 2 - r.top };
        const z = clampZoom((pz.zoom * dist) / Math.max(1, pz.dist), fit);
        const p = zoomAround(pz.mid, { pan: pz.pan, zoom: pz.zoom }, z);
        setZoom(z);
        setPan(clampPan({ x: p.x + (mid.x - pz.mid.x), y: p.y + (mid.y - pz.mid.y) }, z, vp, { w: world.w, h: worldH }));
        return;
      }
    }
    const g = gestureRef.current;
    if (!g) return;
    if (g.kind === "pan") {
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      const moved = g.moved || Math.hypot(dx, dy) > 4;
      setPan(clampPan({ x: g.pan.x + dx, y: g.pan.y + dy }, zoom, vp, { w: world.w, h: worldH }));
      if (moved !== g.moved) setG({ ...g, moved });
    } else if (g.kind === "marquee") {
      const p = clampToWorld(worldPoint(e));
      const rect = { x: Math.min(g.start.x, p.x), y: Math.min(g.start.y, p.y), w: Math.abs(p.x - g.start.x), h: Math.abs(p.y - g.start.y) };
      setG({ ...g, rect: rect.w > 10 || rect.h > 10 ? rect : null });
    } else if (g.kind === "block") {
      const p = worldPoint(e);
      const delta = { x: p.x - g.start.x, y: p.y - g.start.y };
      setG({ ...g, delta, moved: g.moved || Math.hypot(delta.x, delta.y) > 6 });
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") {
      pointers.current.delete(e.pointerId);
      if (pinch.current) {
        if (pointers.current.size < 2) pinch.current = null;
        pickerStore.suppressClick();
        return;
      }
    }
    const g = gestureRef.current;
    if (!g) return;
    setG(null);
    const wall = wallRef.current!;
    if (g.kind === "pan") {
      if (g.moved) pickerStore.suppressClick();
      return;
    }
    if (g.kind === "marquee") {
      pickerStore.suppressClick();
      const r = viewportRef.current!.getBoundingClientRect();
      // a space is anything you dragged out, a skinny line included; only a click-sized twitch is a point
      if (g.rect && Math.max(g.rect.w, g.rect.h) >= 40 && Math.min(g.rect.w, g.rect.h) >= 3) {
        const rect = g.rect;
        const contains = layout.placed.filter((p) => p.x < rect.x + rect.w && p.x + p.w > rect.x && p.y < rect.y + rect.h && p.y + p.h > rect.y).map((p) => p.id);
        const client = new DOMRect(r.left + pan.x + rect.x * zoom, r.top + pan.y + rect.y * zoom, rect.w * zoom, rect.h * zoom);
        pickerStore.select({ path: NEW_BLOCK_PATH, line: 0, blockId: undefined, blockTitle: "This space", tag: "region", text: regionText(rect, contains), rect: client, element: wall, granularity: "block", point: { x: e.clientX, y: e.clientY } });
      } else {
        const p = worldPoint(e);
        if (!insideWorld(p)) return;
        pickerStore.select({ path: NEW_BLOCK_PATH, line: 0, blockId: undefined, blockTitle: "New block", tag: "wall", text: pointText(p), rect: new DOMRect(e.clientX - 8, e.clientY - 8, 16, 16), element: wall, granularity: "block", point: { x: e.clientX, y: e.clientY } });
      }
      return;
    }
    if (g.kind === "block") {
      if (!g.moved) return; // a plain click: the picker handles it
      pickerStore.suppressClick();
      const section = wall.querySelector<HTMLElement>(`[data-ab-block="${CSS.escape(g.id)}"]`);
      const t = section ? resolveTarget(section.querySelector(".frame-body") ?? section) : null;
      const to = { x: Math.round(Math.max(pad, g.from.x + g.delta.x)), y: Math.round(Math.max(pad, g.from.y + g.delta.y)) };
      if (t && section) {
        const title = blocks.find((b) => b.meta.id === g.id)?.meta.title ?? g.id;
        pickerStore.select({ ...t, blockId: g.id, granularity: "block", rect: section.getBoundingClientRect(), element: section, text: `move to ${to.x},${to.y}`, draft: `Move ${title} to x=${to.x}, y=${to.y} on the canvas (keep its width).`, point: { x: e.clientX, y: e.clientY } });
      }
    }
  };

  // heat: cursors and fresh asks warm the ground
  const heat = useMemo(() => {
    if (!canvas.heat) return [];
    const spots: Array<{ x: number; y: number; r: number; a: number }> = [];
    for (const p of peersQ ?? []) spots.push({ x: p.x * world.w, y: p.y * worldH, r: 260, a: 0.16 });
    for (const r of requests) {
      if (now - r.createdAt > DAY) continue;
      const p = r.target.blockId ? at.get(r.target.blockId) : undefined;
      const region = parseRegion(r.target.text);
      const point = parsePoint(r.target.text);
      const c = p ? { x: p.x + p.w / 2, y: p.y + p.h / 2 } : region ? { x: region.x + region.w / 2, y: region.y + region.h / 2 } : point;
      if (c) spots.push({ x: c.x, y: c.y, r: 380, a: 0.1 * Math.max(0.2, 1 - (now - r.createdAt) / DAY) });
    }
    return spots;
  }, [peersQ, requests, at, now, world.w, worldH]);

  // the ship toast: the latest thing that just went live
  const shipped = requests.filter((r) => r.status === "live" && now - r.createdAt < 3 * 60_000).sort((a, b) => b.createdAt - a.createdAt)[0];
  const dyingToday = [...facts.values()].filter((f) => f.left != null && f.left > 0 && f.left < DAY).length;

  const focus = (id: string) => {
    const p = at.get(id);
    if (p) goTo({ x: p.x + p.w / 2, y: p.y + Math.min(p.h / 2, 260) }, Math.max(zoom, 0.85));
  };

  const worldStyle = {
    ...wallStyle(canvas, false),
    width: world.w,
    height: worldH,
    padding: 0,
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    "--zoom": String(zoom),
  } as CSSProperties;
  const liquid = skin === "paper" ? hung.filter((b) => b.h.body.merge).map((b) => ({ id: b.meta.id, body: b.h.body, tilt: b.h.tilt })) : [];

  return (
    <RoomContext.Provider value={room.id}>
      <div className={cn("canvas-shell", compact && "is-compact")} data-skin={skin}>
        <div className="canvas-column">
        <div
          ref={viewportRef}
          className="canvas-viewport"
          data-room={room.id}
          data-canvas
          data-pan={gesture?.kind === "pan" ? "active" : ""}
          onPointerDownCapture={(e) => {
            if (!pickerStore.get().arming) return;
            if ((e.target as HTMLElement).closest("[data-canvas-bar], [data-minimap], [data-canvas-ui]")) return; // the floating UI keeps its own handlers
            onPointerDown(e); // the canvas gesture (marquee, point, drag) still starts
            e.stopPropagation(); // the block under the pointer never hears it
          }}
          onPointerMoveCapture={(e) => {
            setMe(worldPoint(e));
            if (!pickerStore.get().arming) return;
            onPointerMove(e);
            // no stopPropagation: the picker's hover listener lives on window and needs the move; a block cannot draw from a move it never got a pointerdown for
          }}
          onPointerUpCapture={(e) => {
            if (!pickerStore.get().arming) return;
            if ((e.target as HTMLElement).closest("[data-canvas-bar], [data-minimap], [data-canvas-ui]")) return;
            onPointerUp(e);
            e.stopPropagation();
          }}
          onPointerDown={(e) => {
            if (pickerStore.get().arming) return; // already handled in the capture phase
            onPointerDown(e);
          }}
          onPointerMove={(e) => {
            if (pickerStore.get().arming) return;
            onPointerMove(e);
          }}
          onPointerUp={(e) => {

            if (pickerStore.get().arming) return;

            onPointerUp(e);

          }}
          onPointerCancel={(e) => {
            pointers.current.delete(e.pointerId);
            if (pointers.current.size < 2) pinch.current = null;
            setG(null);
          }}
        >
          <div ref={wallRef} className="wall canvas-world" style={worldStyle} data-grid={canvas.grid ?? "dots"} data-world={`${world.w}x${worldH}`} data-content-bottom={Math.round(layout.bottom)} data-zoom={zoom.toFixed(3)} data-zoomband={zoom < 0.22 ? "far" : zoom < 0.7 ? "mid" : "near"}>
            <Heat spots={heat} world={{ w: world.w, h: worldH }} />
            {liquid.length ? <LiquidLayer wallRef={wallRef} bodies={liquid} goo={canvas.goo ?? true} morph={canvas.morph ?? true} /> : null}
            {hung.map(({ meta, Component, path, h }) => {
              const shape = shapeStyle(h.shape, h.body);
              const p = at.get(meta.id);
              const f = facts.get(meta.id)!;
              const drag = gesture?.kind === "block" && gesture.id === meta.id && gesture.moved ? gesture.delta : null;
              const explicitShape = meta.shape != null;
              const style = {
                ...(skin === "instrument" && !explicitShape ? {} : shape.style),
                left: (p?.x ?? pad) + (drag?.x ?? 0),
                top: (p?.y ?? pad) + (drag?.y ?? 0),
                width: p?.w ?? widthFor(meta, world, pad, gap),
                "--tilt": `${drag || skin === "instrument" ? 0 : h.tilt}deg`,
                zIndex: drag ? 20 : undefined,
              } as CSSProperties;
              return (
                <section
                  key={meta.id}
                  data-ab-block={meta.id}
                  data-ab-path={path}
                  data-shape={typeof h.shape === "string" ? h.shape : "custom"}
                  data-pinned={p?.pinned ? "1" : undefined}
                  data-pinned-forever={meta.pinned ? "1" : undefined}
                  data-life={f.left == null ? "pinned" : f.faded ? "faded" : f.left < DAY ? "dying" : "alive"}
                  style={style}
                  className={cn("hung flex flex-col", skin === "instrument" ? (explicitShape ? cn("object", shape.className) : "object") : shape.className, skin === "paper" && h.body.merge && "liquid-body", drag && "dragging", f.faded && "faded", f.editing && "editing")}
                  title={`${meta.title}${f.by ? ` · @${f.by}` : ""}${f.left == null ? " · pinned" : f.faded ? " · faded, touch to revive" : ""}`}
                >
                  <div className="frame-body flex-1">
                    <BlockBoundary title={meta.title}>
                      <Component />
                    </BlockBoundary>
                  </div>
                </section>
              );
            })}
            {/* always-empty canvas at the bottom: pointing here means "add a block" (and it's where tests point) */}
            {roomForAddZone ? (<section

              data-ab-block="__new__"
              data-ab-path={NEW_BLOCK_PATH}
              className="canvas-add flex flex-col"
              style={{ left: pad, top: worldH - ADD_ZONE - pad, width: world.w - pad * 2, height: ADD_ZONE }}
            >
              <div className="frame-body flex flex-1 flex-col items-center justify-center p-6 text-center">
                <p className="text-[15px] text-ink-2">Nothing lives here yet.</p>
                <p className="mt-1 text-[13px] text-muted">Point here to add something. Hold ⇧⌘ and drag out a space to work on it, or drag an object to move it.</p>
              </div>
            </section>) : null}
            {gesture?.kind === "marquee" && gesture.rect ? <div className="marquee" style={{ left: gesture.rect.x, top: gesture.rect.y, width: gesture.rect.w, height: gesture.rect.h }} /> : null}
            <Pins at={at} />
            <Cursors roomId={room.id} boxRef={wallRef} scale={1 / zoom} />
          </div>

          {canvas.minimap !== false ? <Minimap world={{ w: world.w, h: worldH }} placed={layout.placed} pan={pan} zoom={zoom} viewport={vp} onGo={(p) => goTo(p)} onGoBlock={focus} compact={compact} mark={gesture?.kind === "marquee" ? gesture.rect : null} me={me} /> : null}
          <CanvasBar
            zoom={zoom}
            fit={fit}
            onZoom={(z) => applyZoom(z)}
            onFit={() => applyZoom(fit)}
            compact={compact}
            toast={shipped ? `${shipped.user.guest ? "a guest" : "@" + shipped.user.handle} shipped: ${shipped.run?.summary ?? shipped.prompt}` : dyingToday ? `${dyingToday} ${dyingToday === 1 ? "thing fades" : "things fade"} today unless touched` : null}
          />
          {pages.length ? (
            <nav aria-label="Pages" className="canvas-pages" data-canvas-ui>
              <span className="placard smallcaps">pages</span>
              {pages.map((p) => (
                <PageLink key={p.meta.slug} to={p.meta.slug} className="directory-chip">
                  {p.meta.title}
                </PageLink>
              ))}
            </nav>
          ) : null}
          <HowTo />
        </div>
        </div>
      </div>
    </RoomContext.Provider>
  );
}

/** Phones: the same blocks, stacked, no zoom. */
function StackedRoom() {
  const pages = pagesFor(room.id);
  const wallRef = useRef<HTMLDivElement | null>(null);
  const { provenance, lifeBy } = useBlockFacts();
  const now = useNow(60_000);
  const hung = blocks.map((b) => ({ ...b, h: hang(b.meta, canvas) }));
  const skin = canvas.skin ?? "instrument";
  const liquid = skin === "paper" ? hung.filter((b) => b.h.body.merge).map((b) => ({ id: b.meta.id, body: b.h.body, tilt: b.h.tilt })) : [];
  return (
    <RoomContext.Provider value={room.id}>
      <div ref={wallRef} className="wall wall-stack relative grid" style={wallStyle(canvas, false)} data-room={room.id} data-flow="grid" data-skin={skin}>
        {liquid.length ? <LiquidLayer wallRef={wallRef} bodies={liquid} goo={canvas.goo ?? true} morph={canvas.morph ?? true} /> : null}
        {pages.length > 0 ? (
          <nav aria-label="Pages" className="wall-full flex flex-wrap items-center gap-2 px-1">
            <span className="placard smallcaps">Pages</span>
            {pages.map((p) => (
              <PageLink key={p.meta.slug} to={p.meta.slug} className="rounded-md border border-line px-2.5 py-1 text-[13px] hover:bg-paper-2">
                {p.meta.title}
              </PageLink>
            ))}
          </nav>
        ) : null}
        {hung.map(({ meta, Component, path, h }) => {
          const shape = shapeStyle(h.shape, h.body);
          const p = provenance[meta.id];
          const l = lifeBy.get(meta.id);
          const { left } = lifeLeft({ decayDays: canvas.decay, pinned: meta.pinned, lastTouchedAt: l?.lastTouchedAt ?? null, fallback: p?.lastAt ?? now, now });
          if (l?.fadedAt || (left != null && left <= 0)) return null;
          return (
            <section key={meta.id} data-ab-block={meta.id} data-ab-path={path} data-shape={typeof h.shape === "string" ? h.shape : "custom"} style={skin === "instrument" && meta.shape == null ? undefined : shape.style} className={cn("hung wall-full flex flex-col", skin === "instrument" ? (meta.shape != null ? cn("object", shape.className) : "object") : shape.className, skin === "paper" && h.body.merge && "liquid-body")}>
              <div className="frame-body flex-1">
                <BlockBoundary title={meta.title}>
                  <Component />
                </BlockBoundary>
              </div>
            </section>
          );
        })}
        <section data-ab-block="__new__" data-ab-path={NEW_BLOCK_PATH} className="wall-full flex min-h-[160px] flex-col rounded-[var(--radius-frame)] border border-dashed border-line-2/70">
          <div className="frame-body flex flex-1 flex-col items-center justify-center p-8 text-center">
            <p className="text-[13px] text-muted">Point here to add something.</p>
          </div>
        </section>
      </div>
    </RoomContext.Provider>
  );
}
