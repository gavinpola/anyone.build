import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import type { BlockModule } from "@/kit";
import { PageLink } from "@/kit/PageLink";
import { BlockContext, RoomContext } from "@/kit/room-context";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { hasConvex, useQuerySafe } from "@/core/lib/providers";
import { track } from "@/core/lib/analytics";
import { tabSessionId } from "@/core/lib/session";
import { useNow } from "@/core/lib/useNow";
import { useRequests } from "@/core/lib/useRequests";
import { useViewer } from "@/core/auth/useViewer";
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
import { ObjectSheet } from "./ObjectSheet";
import { useTouch } from "./useTouch";
import { sheetStore, useSheet } from "./sheetStore";
import { keysStore, useActiveBlock } from "./keysStore";
import {
  TILE_H,
  TILE_W,
  GUTTER,
  blockAtTile,
  camForTiles,
  clampCam,
  isFree,
  lifeLeft,
  nearestFreeTile,
  packTiles,
  parseTile,
  parseTiles,
  spawnTile,
  tileAt,
  tileBox,
  tileGround,
  tileOfView,
  tileText,
  tilesCovering,
  tilesTall,
  tilesText,
  tilesWide,
  toWorld,
  worldBounds,
  type Cam,
  type Placed,
  type Rect,
  type Tile,
  type TileRect,
} from "./canvas";
import { pickerStore, resolveTarget, usePicker } from "@/core/picker/pickerStore";
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
const IN_FLIGHT = new Set(["queued", "building", "validating", "reviewing", "preview", "merging"]);
const DAY = 86_400_000;
const LANDED_FOR = 3 * 60_000; // a block that landed this recently drops in when you arrive
const VIEW_KEY = "tiles-v1"; // the saved camera only applies to this geometry
const GLIDE_MS = 220;
const ESTIMATED_H = 160; // a block's height before its first paint

/** The wall: an unbounded world of tiles you walk at 100%; the same blocks stacked when the wall asks for it. */
export function Room({ tile = null }: { tile?: Tile | null } = {}) {
  const [stacked, setStacked] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const f = () => setStacked(mq.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return stacked && canvas.mobile === "stack" ? <StackedRoom /> : <WorldRoom compact={stacked} tile={tile} />;
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
  | { kind: "pan"; startX: number; startY: number; cam: Cam; moved: boolean; onBlock: string | null }
  | { kind: "marquee"; start: { x: number; y: number }; rect: Rect | null }
  | { kind: "block"; id: string; start: { x: number; y: number }; delta: { x: number; y: number }; moved: boolean };

/** The live parts of a block keep a finger (a game, a canvas, a button, a field); its quiet parts (text, a card) walk the world. */
function interactive(el: HTMLElement): boolean {
  return Boolean(el.closest("canvas, button, input, textarea, select, a, [role='button'], [role='slider'], [tabindex], [contenteditable], [data-no-pan]"));
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function WorldRoom({ compact, tile }: { compact: boolean; tile: Tile | null }) {
  const pages = pagesFor(room.id);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const wallRef = useRef<HTMLDivElement | null>(null);
  const now = useNow(30_000);
  const { provenance, lifeBy } = useBlockFacts();
  const requests = useRequests();
  const viewer = useViewer();
  const peersQ = useQuerySafe(api.cursors.active, hasConvex ? { roomId: room.id, sessionId: tabSessionId() } : "skip");
  const decayOn = Boolean(canvas.decay) && (canvas.decay as number) > 0;
  const skin = canvas.skin ?? "instrument";
  const showAll = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("all");
  const { arming } = usePicker();
  const sheet = useSheet();
  const active = useActiveBlock();

  // facts per block: who, when, how long left, faded, editing
  const facts = useMemo(() => {
    const editing = new Set(requests.filter((r) => IN_FLIGHT.has(r.status) && r.target.blockId).map((r) => r.target.blockId!));
    const out = new Map<string, { by: string | null; lastAt: number | null; changes: number; left: number | null; window: number; faded: boolean; editing: boolean; isNew: boolean; mine: boolean }>();
    for (const b of blocks) {
      const p = provenance[b.meta.id];
      const l = lifeBy.get(b.meta.id);
      const { left, window } = lifeLeft({ decayDays: canvas.decay, pinned: b.meta.pinned, lastTouchedAt: l?.lastTouchedAt ?? null, fallback: p?.lastAt ?? now, now });
      const faded = Boolean(l?.fadedAt) || (left != null && left <= 0);
      const by = p?.lastBy ?? p?.guestTag ?? null;
      out.set(b.meta.id, { by, lastAt: p?.lastAt ?? null, changes: p?.changes ?? 0, left, window, faded, editing: editing.has(b.meta.id), isNew: (p?.lastAt ?? 0) > now - DAY, mine: by != null && by === viewer.handle });
    }
    return out;
  }, [provenance, lifeBy, requests, now, viewer.handle]);
  const visible = useMemo(() => blocks.filter((b) => showAll || !facts.get(b.meta.id)?.faded), [facts, showAll]);
  const ids = visible.map((b) => b.meta.id).join("|");
  const heights = useHeights(wallRef, ids);
  const measured = visible.every((b) => heights[b.meta.id] != null);

  const hung = useMemo(() => visible.map((b) => ({ ...b, h: hang(b.meta, canvas) })), [visible]);
  // where everything sits, in tiles: placed blocks stay, the rest pack outward from 0,0
  const layout = useMemo(
    () => packTiles(hung.map((b) => ({ id: b.meta.id, w: tilesWide(b.meta), h: tilesTall(heights[b.meta.id] ?? ESTIMATED_H), place: b.meta.place, order: b.meta.order }))),
    [hung, heights],
  );
  const at = useMemo(() => new Map(layout.map((p) => [p.id, p])), [layout]);
  const boxes = useMemo(() => new Map(layout.map((p) => [p.id, tileBox(p)])), [layout]);
  const bounds = useMemo(() => worldBounds(layout), [layout]);

  // the camera: a translate, never a scale
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [cam, setCamState] = useState<Cam>({ x: 0, y: 0 });
  const camRef = useRef(cam);
  const vpRef = useRef(vp);
  const boundsRef = useRef(bounds);
  useLayoutEffect(() => {
    vpRef.current = vp;
    boundsRef.current = bounds;
  }, [vp, bounds]);
  const setCam = useCallback((c: Cam) => {
    const n = clampCam(c, vpRef.current, boundsRef.current);
    camRef.current = n;
    setCamState(n);
  }, []);
  const anim = useRef<number | null>(null);
  const stopGlide = () => {
    if (anim.current != null) cancelAnimationFrame(anim.current);
    anim.current = null;
  };
  /** Ease the camera somewhere (an arrow key, a teleport); a plain set when motion is reduced. */
  const glide = useCallback(
    (to: Cam, ms = GLIDE_MS) => {
      stopGlide();
      const from = camRef.current;
      const target = clampCam(to, vpRef.current, boundsRef.current);
      if (ms <= 0 || reducedMotion()) {
        setCam(target);
        return;
      }
      const t0 = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / ms);
        const e = 1 - Math.pow(1 - k, 3);
        setCam({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e });
        anim.current = k < 1 ? requestAnimationFrame(step) : null;
      };
      anim.current = requestAnimationFrame(step);
    },
    [setCam],
  );
  useEffect(() => stopGlide, []);
  const goToTile = useCallback((t: Tile) => glide(camForTiles({ ...t, w: 1, h: 1 }, vpRef.current)), [glide]);
  const goToBlock = useCallback(
    (id: string) => {
      const p = at.get(id);
      if (!p) return;
      glide(camForTiles(p, vpRef.current));
      keysStore.activate(id); // you went to it: it has the keys
    },
    [at, glide],
  );
  /** Give a block the keys, and focus it so blocks that listen on a focusable element hear them too. */
  const activate = useCallback((id: string) => {
    keysStore.activate(id);
    const section = wallRef.current?.querySelector<HTMLElement>(`[data-ab-block="${CSS.escape(id)}"]`);
    const focusable = section?.querySelector<HTMLElement>("[tabindex]:not([tabindex='-1']), canvas[tabindex]");
    const a = document.activeElement as HTMLElement | null;
    if (focusable && !(a && section?.contains(a))) focusable.focus({ preventScroll: true });
  }, []);
  // a block that left the wall gives the keys back
  useEffect(() => {
    if (active && !at.has(active)) keysStore.deactivate(active);
  }, [active, at]);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setVp({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // heat per block: fresh asks and people nearby
  const heatBy = useMemo(() => {
    const out: Record<string, number> = {};
    for (const r of requests) {
      if (now - r.createdAt > DAY || !r.target.blockId) continue;
      out[r.target.blockId] = (out[r.target.blockId] ?? 0) + Math.max(0.2, 1 - (now - r.createdAt) / DAY);
    }
    for (const p of peersQ ?? []) {
      const b = blockAtTile({ x: Math.floor(p.x), y: Math.floor(p.y) }, layout);
      if (b) out[b.id] = (out[b.id] ?? 0) + 1;
    }
    for (const [id, l] of lifeBy) if (l.lastTouchedAt && now - l.lastTouchedAt < DAY) out[id] = (out[id] ?? 0) + 0.5;
    return out;
  }, [requests, peersQ, lifeBy, layout, now]);
  const spawn = useMemo(() => {
    const lastAt: Record<string, number | null> = {};
    for (const [id, f] of facts) lastAt[id] = f.lastAt;
    return spawnTile({ placed: layout, lastAt, heat: heatBy, now });
  }, [layout, facts, heatBy, now]);

  // where you land: a deep link's tile, where you were before the quiet refresh, or where the action is
  const landed = useRef<"no" | "provisional" | "final">("no");
  const walked = useRef(false);
  useLayoutEffect(() => {
    if (!vp.w || landed.current !== "no" || (!measured && visible.length)) return;
    if (tile) {
      landed.current = "final";
      setCam(camForTiles({ ...tile, w: 1, h: 1 }, vp));
      return;
    }
    const saved = loadView(VIEW_KEY);
    if (saved) {
      landed.current = "final";
      setCam(saved.cam);
      return;
    }
    // the facts (who made what, when) may still be on their way: land now, land again when they arrive
    landed.current = !hasConvex || Object.keys(provenance).length ? "final" : "provisional";
    setCam(camForTiles({ ...spawn, w: 1, h: 1 }, vp));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vp.w, measured]);
  useEffect(() => {
    if (landed.current !== "provisional" || walked.current || !Object.keys(provenance).length) return;
    landed.current = "final";
    glide(camForTiles({ ...spawn, w: 1, h: 1 }, vpRef.current), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provenance]);
  // a deep link changes under a mounted room
  const tileKey = tile ? `${tile.x},${tile.y}` : "";
  useEffect(() => {
    if (tile && landed.current !== "no") goToTile(tile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileKey]);
  // a shared link's bar asks for a block
  useEffect(() => {
    const onFocus = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (id) goToBlock(id);
    };
    window.addEventListener("ab:focus-block", onFocus);
    return () => window.removeEventListener("ab:focus-block", onFocus);
  }, [goToBlock]);
  // the world grew or shrank: stay over it
  useEffect(() => {
    if (landed.current !== "no") setCam(camRef.current);
  }, [bounds.x, bounds.y, bounds.w, bounds.h, vp.w, vp.h, setCam]);
  useEffect(() => {
    if (landed.current === "no") return;
    const t = setTimeout(() => saveView({ cam, world: VIEW_KEY }), 250);
    return () => clearTimeout(t);
  }, [cam]);

  // the wheel walks (two axes); there is no zoom
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (pickerStore.get().selected) return; // a change is being proposed: the world holds still under the composer
      if (e.ctrlKey || e.metaKey) return;
      stopGlide();
      walked.current = true;
      setCam({ x: camRef.current.x + e.deltaX, y: camRef.current.y + e.deltaY });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setCam]);
  // arrow keys walk one tile, unless a block or a field has the keyboard
  useEffect(() => {
    const steps: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (sheetStore.get().moving) sheetStore.stopMove();
        else if (keysStore.get().active && !pickerStore.get().selected && !sheetStore.get().blockId) {
          keysStore.deactivate();
          (document.activeElement as HTMLElement | null)?.blur?.();
        }
        return;
      }
      const step = steps[e.key];
      if (!step || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (keysStore.get().active) return; // a block has the keys: arrows steer it, they don't walk
      const a = document.activeElement as HTMLElement | null;
      if (a && a !== document.body && a !== viewportRef.current && !a.closest("[data-canvas-bar], [data-minimap], [data-canvas-ui]")) return;
      if (pickerStore.get().selected || !viewportRef.current?.isConnected) return;
      e.preventDefault();
      walked.current = true;
      glide({ x: camRef.current.x + step[0] * TILE_W, y: camRef.current.y + step[1] * TILE_H });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [glide]);
  useTouch(wallRef, decayOn);
  // pointing (the chord or Change) closes the sheet
  useEffect(() => {
    if (arming) sheetStore.close();
  }, [arming]);

  // gestures: walk on the ground (and on a block's quiet parts, by touch); in pick mode, drag out tiles or drag a block
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const setG = (g: Gesture | null) => {
    gestureRef.current = g;
    setGesture(g);
  };
  const worldPoint = useCallback((e: { clientX: number; clientY: number }) => {
    const r = viewportRef.current!.getBoundingClientRect();
    return toWorld({ x: e.clientX, y: e.clientY }, r, camRef.current);
  }, []);
  const clientRectOf = (r: Rect) => {
    const v = viewportRef.current!.getBoundingClientRect();
    return new DOMRect(v.left + r.x - camRef.current.x, v.top + r.y - camRef.current.y, r.w, r.h);
  };
  const inBounds = (t: Tile) => t.x >= bounds.x && t.x < bounds.x + bounds.w && t.y >= bounds.y && t.y < bounds.y + bounds.h;

  /** "Add something here": the composer opens for one tile. */
  const selectTile = (t: Tile, point?: { x: number; y: number }) => {
    const wall = wallRef.current!;
    pickerStore.select({ path: NEW_BLOCK_PATH, line: 0, blockId: undefined, blockTitle: "New block", tag: "wall", text: tileText(t), rect: clientRectOf(tileGround({ ...t, w: 1, h: 1 })), element: wall, granularity: "block", point });
  };
  /** A block should go somewhere else: the ask is written for you. */
  const proposeMove = (id: string, to: Tile, point?: { x: number; y: number }) => {
    const wall = wallRef.current!;
    const section = wall.querySelector<HTMLElement>(`[data-ab-block="${CSS.escape(id)}"]`);
    const t = section ? resolveTarget(section.querySelector(".frame-body") ?? section) : null;
    if (!t || !section) return;
    const title = blocks.find((b) => b.meta.id === id)?.meta.title ?? id;
    pickerStore.select({ ...t, blockId: id, granularity: "block", rect: section.getBoundingClientRect(), element: section, text: `move to ${tileText(to)}`, draft: `Move ${title} to tile ${to.x},${to.y} (keep its size).`, point });
  };

  // the add zone: the tile you tapped, or the free tile nearest the middle of your screen
  const [pickedAdd, setPickedAdd] = useState<Tile | null>(null);
  const here = tileOfView(cam, vp);
  const camStep = { x: Math.round(cam.x / 40), y: Math.round(cam.y / 40) }; // the add zone re-chooses every 40px of walking, not every frame
  const addTile = useMemo(() => {
    if (pickedAdd && isFree(pickedAdd, layout) && inBounds(pickedAdd)) return pickedAdd;
    // the screen, in tiles, minus the bar along the bottom: a tile you can see whole beats a nearer one cut off
    const screen = { x: cam.x / TILE_W, y: cam.y / TILE_H, w: vp.w / TILE_W, h: Math.max(1, (vp.h - 72) / TILE_H) };
    return nearestFreeTile({ x: (cam.x + vp.w / 2) / TILE_W, y: (cam.y + vp.h / 2) / TILE_H }, layout, bounds, screen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedAdd, layout, bounds, camStep.x, camStep.y, vp.w, vp.h]);

  // is the add tile's middle on screen? if not, the add zone floats over the viewport instead and walks you there
  const addOnScreen = (() => {
    if (!addTile) return false;
    const cx = addTile.x * TILE_W + TILE_W / 2 - cam.x;
    const cy = addTile.y * TILE_H + TILE_H / 2 - cam.y;
    return cx >= 0 && cx <= vp.w && cy >= 0 && cy <= vp.h - 72;
  })();

  const onGroundTap = (p: { x: number; y: number }, onBlock: string | null, e: React.PointerEvent) => {
    const s = sheetStore.get();
    if (s.moving) {
      const to = tileAt(p);
      sheetStore.stopMove();
      if (to.x !== at.get(s.moving)?.x || to.y !== at.get(s.moving)?.y) proposeMove(s.moving, to, { x: e.clientX, y: e.clientY });
      return;
    }
    sheetStore.close();
    if (!onBlock) keysStore.deactivate(); // the ground: the keys walk again
    if (onBlock === "__new__") {
      // the viewport captured the pointer, so no click reaches the add zone: the tap is the ask
      pickerStore.suppressClick();
      if (addTile) selectTile(addTile, { x: e.clientX, y: e.clientY });
      return;
    }
    if (onBlock) return; // a tap on an object is the object's own
    const t = tileAt(p);
    if (isFree(t, layout) && inBounds(t)) setPickedAdd(t);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (pickerStore.get().selected) return; // proposing a change: the world holds still until the composer closes
    const target = e.target as HTMLElement;
    if (target.closest("[data-canvas-bar], [data-minimap], [data-canvas-ui], .object-sheet")) return;
    const section = target.closest<HTMLElement>("[data-ab-block]");
    const id = section?.dataset.abBlock ?? null;
    const inBlock = section && id !== "__new__" && wallRef.current?.contains(section);
    const picking = pickerStore.get().arming;
    if (picking) {
      if (inBlock) {
        if (!at.get(id!)) return;
        setG({ kind: "block", id: id!, start: worldPoint(e), delta: { x: 0, y: 0 }, moved: false });
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } else if (!section) {
        setG({ kind: "marquee", start: worldPoint(e), rect: null });
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
      return;
    }
    if (inBlock) activate(id!); // the object you touch has the keys
    if (target.closest(".object-label")) return; // the label is a button: its click opens the sheet
    // a mouse walks from the ground only (text in a block stays selectable); a finger walks from a block's quiet parts too
    if (inBlock && (e.pointerType !== "touch" || interactive(target))) return;
    stopGlide();
    setG({ kind: "pan", startX: e.clientX, startY: e.clientY, cam: camRef.current, moved: false, onBlock: section ? id : null });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (!g) return;
    if (g.kind === "pan") {
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      const moved = g.moved || Math.hypot(dx, dy) > 4;
      if (moved) {
        walked.current = true;
        setCam({ x: g.cam.x - dx, y: g.cam.y - dy });
      }
      if (moved !== g.moved) setG({ ...g, moved });
    } else if (g.kind === "marquee") {
      const p = worldPoint(e);
      const rect = { x: Math.min(g.start.x, p.x), y: Math.min(g.start.y, p.y), w: Math.abs(p.x - g.start.x), h: Math.abs(p.y - g.start.y) };
      setG({ ...g, rect: rect.w > 10 || rect.h > 10 ? rect : null });
    } else if (g.kind === "block") {
      const p = worldPoint(e);
      const delta = { x: p.x - g.start.x, y: p.y - g.start.y };
      setG({ ...g, delta, moved: g.moved || Math.hypot(delta.x, delta.y) > 6 });
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (!g) return;
    setG(null);
    const wall = wallRef.current!;
    if (g.kind === "pan") {
      if (g.moved) pickerStore.suppressClick();
      else onGroundTap(worldPoint(e), g.onBlock, e);
      return;
    }
    if (g.kind === "marquee") {
      pickerStore.suppressClick();
      // a space is anything you dragged out, a skinny line included; only a click-sized twitch is a point
      if (g.rect && Math.max(g.rect.w, g.rect.h) >= 40 && Math.min(g.rect.w, g.rect.h) >= 3) {
        const tiles = tilesCovering(g.rect);
        const contains = layout.filter((p) => p.x < tiles.x + tiles.w && p.x + p.w > tiles.x && p.y < tiles.y + tiles.h && p.y + p.h > tiles.y).map((p) => p.id);
        pickerStore.select({ path: NEW_BLOCK_PATH, line: 0, blockId: undefined, blockTitle: "This space", tag: "region", text: tilesText(tiles, contains), rect: clientRectOf(tileGround(tiles)), element: wall, granularity: "block", point: { x: e.clientX, y: e.clientY } });
      } else {
        selectTile(tileAt(worldPoint(e)), { x: e.clientX, y: e.clientY });
      }
      return;
    }
    if (g.kind === "block") {
      if (!g.moved) return; // a plain click: the picker handles it
      pickerStore.suppressClick();
      const p = at.get(g.id);
      if (!p) return;
      proposeMove(g.id, { x: p.x + Math.round(g.delta.x / TILE_W), y: p.y + Math.round(g.delta.y / TILE_H) }, { x: e.clientX, y: e.clientY });
    }
  };

  // your own pointer, as a tile, for the map
  const [me, setMe] = useState<Tile | null>(null);
  const trackMe = (e: React.PointerEvent) => {
    const t = tileAt(worldPoint(e));
    setMe((m) => (m && m.x === t.x && m.y === t.y ? m : t));
  };

  // heat: cursors and fresh asks warm the ground
  const peerTiles = useMemo(() => (peersQ ?? []).map((p) => ({ x: p.x, y: p.y })), [peersQ]);
  const heat = useMemo(() => {
    if (!canvas.heat) return [];
    const spots: Array<{ x: number; y: number; r: number; a: number }> = [];
    for (const p of peerTiles) spots.push({ x: p.x * TILE_W, y: p.y * TILE_H, r: 260, a: 0.16 });
    for (const r of requests) {
      if (now - r.createdAt > DAY) continue;
      const b = r.target.blockId ? boxes.get(r.target.blockId) : undefined;
      const tiles = parseTiles(r.target.text);
      const t = parseTile(r.target.text);
      const g = b ?? (tiles ? tileGround(tiles) : t ? tileGround({ ...t, w: 1, h: 1 }) : null);
      if (g) spots.push({ x: g.x + g.w / 2, y: g.y + g.h / 2, r: 380, a: 0.1 * Math.max(0.2, 1 - (now - r.createdAt) / DAY) });
    }
    return spots;
  }, [peerTiles, requests, boxes, now]);

  // the ship toast: the latest thing that just went live; tapping it takes you there
  const shipped = requests.filter((r) => r.status === "live" && now - r.createdAt < 3 * 60_000).sort((a, b) => b.createdAt - a.createdAt)[0];
  const dyingToday = [...facts.values()].filter((f) => f.left != null && f.left > 0 && f.left < DAY).length;
  const newestId = [...facts.entries()].filter(([id]) => at.has(id)).sort((a, b) => (b[1].lastAt ?? 0) - (a[1].lastAt ?? 0))[0]?.[0];
  const onToast = () => {
    const id = shipped?.target.blockId && at.has(shipped.target.blockId) ? shipped.target.blockId : newestId;
    if (id) goToBlock(id);
  };

  // a faded object leaves the wall; the map lists it by name, and a click there touches it back. Once it
  // is placed again, the view goes to it.
  const touchM = useMutation(api.life.touch);
  const pendingRevive = useRef<string | null>(null);
  const fadedList = useMemo(
    () => (showAll ? [] : blocks.filter((b) => facts.get(b.meta.id)?.faded).map((b) => ({ id: b.meta.id, title: b.meta.title }))),
    [facts, showAll],
  );
  const revive = (id: string) => {
    if (!hasConvex) return;
    pendingRevive.current = id;
    track("revive", { block: id });
    void touchM({ roomId: room.id, blockId: id, anonId: tabSessionId() }).catch(() => {
      pendingRevive.current = null;
    });
  };
  useEffect(() => {
    const id = pendingRevive.current;
    if (!id || !at.has(id)) return;
    pendingRevive.current = null;
    goToBlock(id);
  }, [at, goToBlock]);

  const worldStyle = {
    ...wallStyle(canvas, false),
    transform: `translate(${-cam.x}px, ${-cam.y}px)`,
  } as CSSProperties;
  const groundStyle = { "--cam-x": `${cam.x}px`, "--cam-y": `${cam.y}px` } as CSSProperties;
  const liquid = skin === "paper" ? hung.filter((b) => b.h.body.merge).map((b) => ({ id: b.meta.id, body: b.h.body, tilt: b.h.tilt })) : [];
  const ground = tileGround(bounds);
  const marqueeTiles = gesture?.kind === "marquee" && gesture.rect ? tilesCovering(gesture.rect) : null;
  const hot = useMemo(() => new Set(Object.entries(heatBy).filter(([, h]) => (h ?? 0) > 0).map(([id]) => id)), [heatBy]);
  const fresh = useMemo(() => new Set([...facts.entries()].filter(([, f]) => f.isNew).map(([id]) => id)), [facts]);
  const mine = useMemo(() => new Set([...facts.entries()].filter(([, f]) => f.mine).map(([id]) => id)), [facts]);
  const sheetBlock = sheet.blockId ? blocks.find((b) => b.meta.id === sheet.blockId) : null;
  const movingTitle = sheet.moving ? (blocks.find((b) => b.meta.id === sheet.moving)?.meta.title ?? sheet.moving) : null;
  const left = here;
  const nextTo = (dx: number): { t: Tile; block: Placed | null; people: number } => {
    const t = { x: here.x + dx, y: here.y };
    return { t, block: blockAtTile(t, layout), people: peerTiles.filter((p) => Math.floor(p.x) === t.x && Math.floor(p.y) === t.y).length };
  };
  const west = nextTo(-1);
  const east = nextTo(1);

  return (
    <RoomContext.Provider value={room.id}>
      <div className={cn("canvas-shell", compact && "is-compact")} data-skin={skin}>
        <div className="canvas-column">
          <div
            ref={viewportRef}
            className="canvas-viewport"
            style={groundStyle}
            data-room={room.id}
            data-canvas
            data-grid={canvas.grid ?? "dots"}
            data-pan={gesture?.kind === "pan" && gesture.moved ? "active" : ""}
            data-moving={sheet.moving ? "1" : undefined}
            data-more-left={cam.x > ground.x + 8 ? "1" : undefined}
            data-more-right={cam.x + vp.w < ground.x + ground.w - 8 ? "1" : undefined}
            data-more-up={cam.y > ground.y + 8 ? "1" : undefined}
            data-more-down={cam.y + vp.h < ground.y + ground.h - 8 ? "1" : undefined}
            onPointerDownCapture={(e) => {
              if (!pickerStore.get().arming) return;
              if ((e.target as HTMLElement).closest("[data-canvas-bar], [data-minimap], [data-canvas-ui]")) return; // the floating UI keeps its own handlers
              onPointerDown(e); // the canvas gesture (marquee, point, drag) still starts
              e.stopPropagation(); // the block under the pointer never hears it
            }}
            onPointerMoveCapture={(e) => {
              trackMe(e);
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
            onPointerCancel={() => setG(null)}
          >
            <div
              ref={wallRef}
              className="wall canvas-world"
              style={worldStyle}
              data-world="tiles"
              data-tile={`${here.x},${here.y}`}
              data-cam={`${cam.x},${cam.y}`}
              data-bounds={`${bounds.x},${bounds.y},${bounds.w},${bounds.h}`}
              data-blocks={layout.length}
            >
              <Heat spots={heat} area={ground} />
              {liquid.length ? <LiquidLayer wallRef={wallRef} bodies={liquid} goo={canvas.goo ?? true} morph={canvas.morph ?? true} /> : null}
              {hung.map(({ meta, Component, path, h }) => {
                const shape = shapeStyle(h.shape, h.body);
                const p = at.get(meta.id);
                const full = p ? tileBox(p) : { x: GUTTER, y: GUTTER, w: TILE_W - 2 * GUTTER, h: TILE_H };
                // a phone shows one tile across: a two-tile block keeps its tiles (same neighbours everywhere) but its
                // box is one tile wide, so a game fits the screen instead of running off it
                const box = compact ? { ...full, w: Math.min(full.w, TILE_W - 2 * GUTTER) } : full;
                const f = facts.get(meta.id)!;
                const drag = gesture?.kind === "block" && gesture.id === meta.id && gesture.moved ? gesture.delta : null;
                const explicitShape = meta.shape != null;
                const style = {
                  ...(skin === "instrument" && !explicitShape ? {} : shape.style),
                  left: box.x + (drag?.x ?? 0),
                  top: box.y + (drag?.y ?? 0),
                  width: box.w,
                  "--tilt": `${drag || skin === "instrument" ? 0 : h.tilt}deg`,
                  zIndex: drag ? 20 : undefined,
                } as CSSProperties;
                const justLanded = f.lastAt != null && now - f.lastAt < LANDED_FOR;
                const status = f.editing ? "changing…" : f.faded ? "faded" : f.isNew ? "new" : f.left != null && f.left < DAY ? "fades today" : null;
                return (
                  <section
                    key={meta.id}
                    data-ab-block={meta.id}
                    data-ab-path={path}
                    data-shape={typeof h.shape === "string" ? h.shape : "custom"}
                    data-tiles={p ? `${p.x},${p.y},${p.w},${p.h}` : undefined}
                    data-pinned={p?.pinned ? "1" : undefined}
                    data-pinned-forever={meta.pinned ? "1" : undefined}
                    data-life={f.left == null ? "pinned" : f.faded ? "faded" : f.left < DAY ? "dying" : "alive"}
                    style={style}
                    className={cn(
                      "hung flex flex-col",
                      skin === "instrument" ? (explicitShape ? cn("object", shape.className) : "object") : shape.className,
                      skin === "paper" && h.body.merge && "liquid-body",
                      drag && "dragging",
                      f.faded && "faded",
                      f.editing && "editing",
                      justLanded && "landed",
                      sheet.moving === meta.id && "moving",
                      active === meta.id && "is-active",
                    )}
                    data-active={active === meta.id ? "1" : undefined}
                    data-ab-by={f.by ?? undefined}
                    data-ab-left={f.left == null ? "pinned" : f.faded ? "faded" : String(Math.max(0, Math.ceil(f.left / 86_400_000)))}
                    data-ab-when={f.lastAt ?? undefined}
                  >
                    <button
                      type="button"
                      className={cn("object-label", f.isNew && "is-new", f.editing && "is-editing", f.left != null && f.left < DAY && "is-dying", f.faded && "is-faded")}
                      data-object-label={meta.id}
                      aria-label={`${meta.title}: who made it, change it, or move it`}
                      onClick={(e) => {
                        if (pickerStore.clickSuppressed()) return;
                        e.stopPropagation();
                        sheetStore.open(meta.id);
                      }}
                    >
                      <span className="object-who">{f.by ? `@${f.by.replace(/^guest[- ·]*/, "guest · ")}` : "someone"}</span>
                      <span aria-hidden> · </span>
                      <span className="object-title">{meta.title}</span>
                      {p ? <span className="object-size" aria-hidden>{` · ${p.w}×${p.h}`}</span> : null}
                      {status ? <span className="object-status">{status}</span> : null}
                      {active === meta.id ? <span className="object-keys" data-object-keys>● keys</span> : null}
                      <span className="object-hint" aria-hidden>tap to change</span>
                    </button>
                    <div className="frame-body flex-1">
                      <BlockBoundary title={meta.title}>
                        <BlockContext.Provider value={meta.id}>
                          <Component />
                        </BlockContext.Provider>
                      </BlockBoundary>
                    </div>
                  </section>
                );
              })}
              {/* empty ground: one tile where "add something here" lives; the one you tapped, or the free one nearest you */}
              {addTile && addOnScreen
                ? (() => {
                    const g = tileGround({ ...addTile, w: 1, h: 1 });
                    return (
                      <section
                        data-ab-block="__new__"
                        data-ab-path={NEW_BLOCK_PATH}
                        data-ab-text={tileText(addTile)}
                        data-tile={`${addTile.x},${addTile.y}`}
                        className="canvas-add flex flex-col"
                        style={{ left: g.x + GUTTER, top: g.y + GUTTER, width: g.w - 2 * GUTTER, height: g.h - 2 * GUTTER }}
                        onClick={(e) => {
                          if (pickerStore.clickSuppressed()) return;
                          selectTile(addTile, { x: e.clientX, y: e.clientY });
                        }}
                      >
                        <div className="frame-body flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
                          <p className="canvas-add-where">
                            empty ground · tile {addTile.x},{addTile.y}
                          </p>
                          <span className="canvas-add-cta">+ Add something here</span>
                        </div>
                      </section>
                    );
                  })()
                : null}
              {marqueeTiles ? <div className="marquee" style={{ ...tileGround(marqueeTiles), left: tileGround(marqueeTiles).x, top: tileGround(marqueeTiles).y, width: tileGround(marqueeTiles).w, height: tileGround(marqueeTiles).h }} /> : null}
              <Pins at={boxes} />
              <Cursors roomId={room.id} worldPoint={worldPoint} />
            </div>

            {addTile && !addOnScreen ? (
              // every free tile is off screen: the add zone floats here and walks you to the nearest one
              <section
                data-ab-block="__new__"
                data-ab-path={NEW_BLOCK_PATH}
                data-ab-text={tileText(addTile)}
                data-tile={`${addTile.x},${addTile.y}`}
                data-canvas-ui
                className="canvas-add is-floating flex flex-col"
                onClick={(e) => {
                  if (pickerStore.clickSuppressed()) return;
                  const moving = sheetStore.get().moving;
                  goToTile(addTile);
                  if (moving) {
                    sheetStore.stopMove();
                    proposeMove(moving, addTile, { x: e.clientX, y: e.clientY });
                  } else selectTile(addTile, { x: e.clientX, y: e.clientY });
                }}
              >
                <div className="frame-body flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
                  <p className="canvas-add-where">
                    nearest empty ground · tile {addTile.x},{addTile.y}
                  </p>
                  <span className="canvas-add-cta">{sheet.moving ? "Move it here" : "+ Add something here"}</span>
                </div>
              </section>
            ) : null}
            {canvas.minimap !== false ? (
              <Minimap placed={layout} bounds={bounds} cam={cam} viewport={vp} onGo={goToTile} onGoBlock={goToBlock} compact={compact} mark={marqueeTiles} me={me} hot={hot} fresh={fresh} mine={mine} peers={peerTiles} faded={fadedList} onRevive={revive} />
            ) : null}
            <CanvasBar
              tile={here}
              compact={compact}
              toast={shipped ? `${shipped.user.guest ? "a guest" : "@" + shipped.user.handle} shipped: ${shipped.run?.summary ?? shipped.prompt}` : dyingToday ? `${dyingToday} ${dyingToday === 1 ? "thing fades" : "things fade"} today unless touched` : null}
              onToast={shipped ? onToast : undefined}
            />
            {compact ? (
              <nav className="neighbour-strip" data-canvas-ui aria-label="Next door">
                <button type="button" onClick={() => goToTile(west.t)} aria-label={`Walk left to tile ${west.t.x},${west.t.y}`}>
                  ← {west.t.x},{west.t.y}
                  {west.block ? <span className="dot" aria-hidden /> : null}
                  {west.people ? <span className="people">{west.people} here</span> : null}
                </button>
                <span className="here">
                  tile {left.x},{left.y}
                </span>
                <button type="button" onClick={() => goToTile(east.t)} aria-label={`Walk right to tile ${east.t.x},${east.t.y}`}>
                  {east.people ? <span className="people">{east.people} here</span> : null}
                  {east.block ? <span className="dot" aria-hidden /> : null}
                  {east.t.x},{east.t.y} →
                </button>
              </nav>
            ) : (
              <div className="walk-hint" data-canvas-ui aria-hidden data-walk-hint={active ? "keys" : "walk"}>
                {active ? (
                  <>
                    <span className="keys">◄ ▲ ▼ ►</span> {blocks.find((b) => b.meta.id === active)?.meta.title ?? active} has the keys · esc to walk
                  </>
                ) : (
                  <>
                    <span className="keys">◄ ▲ ▼ ►</span> walk · drag the ground · no zoom
                  </>
                )}
              </div>
            )}
            {sheet.moving ? (
              <div className="move-hint" data-canvas-ui role="status">
                Tap where <strong>{movingTitle}</strong> should go
                <button type="button" onClick={() => sheetStore.stopMove()}>
                  Cancel
                </button>
              </div>
            ) : null}
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
      {sheetBlock ? (
        <ObjectSheet
          key={sheetBlock.meta.id}
          id={sheetBlock.meta.id}
          title={sheetBlock.meta.title}
          facts={facts.get(sheetBlock.meta.id)!}
          tiles={at.get(sheetBlock.meta.id) ?? null}
          compact={compact}
          onChange={(point) => {
            const wall = wallRef.current!;
            const section = wall.querySelector<HTMLElement>(`[data-ab-block="${CSS.escape(sheetBlock.meta.id)}"]`);
            const t = section ? resolveTarget(section.querySelector(".frame-body") ?? section) : null;
            sheetStore.close();
            if (t && section) pickerStore.select({ ...t, blockId: sheetBlock.meta.id, blockTitle: sheetBlock.meta.title, granularity: "block", rect: section.getBoundingClientRect(), element: section, point });
          }}
          onMove={() => sheetStore.startMove(sheetBlock.meta.id)}
          onClose={() => sheetStore.close()}
        />
      ) : null}
    </RoomContext.Provider>
  );
}

/** Phones, when the wall asks for it (canvas.mobile = "stack"): the same blocks, stacked. */
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
                  <BlockContext.Provider value={meta.id}>
                    <Component />
                  </BlockContext.Provider>
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

export type { TileRect };
