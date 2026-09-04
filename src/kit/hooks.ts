import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { hasConvex } from "@/core/lib/providers";
import { tabSessionId } from "@/core/lib/session";
import { useViewer as useCoreViewer } from "@/core/auth/useViewer";
import { useRoomPresenceCount } from "@/core/lib/usePresence";

/**
 * Kit hooks: the only "backend" a block can touch. Backed by Convex when configured; an
 * in-memory fallback keeps a fresh clone working with zero setup.
 */
export type Viewer = { handle: string; avatarUrl: string | null; signedIn: boolean };

export function useViewer(): Viewer {
  const v = useCoreViewer();
  return { handle: v.handle, avatarUrl: v.avatarUrl, signedIn: v.signedIn };
}

export type StoreDoc<T> = { key: string; value: T; by: string | null; at: number };

// ---- in-memory fallback ----
const memory = new Map<string, StoreDoc<unknown>[]>();
const listeners = new Map<string, Set<() => void>>();
function emit(ns: string) {
  for (const l of listeners.get(ns) ?? []) l();
}
function useStoreMock<T>(namespace: string) {
  const [docs, setDocs] = useState<StoreDoc<T>[]>(() => (memory.get(namespace) ?? []) as StoreDoc<T>[]);
  useEffect(() => {
    const set = listeners.get(namespace) ?? new Set();
    const l = () => setDocs([...(memory.get(namespace) ?? [])] as StoreDoc<T>[]);
    set.add(l);
    listeners.set(namespace, set);
    return () => {
      set.delete(l);
    };
  }, [namespace]);
  const put = useCallback(
    (key: string, value: T) => {
      const next = (memory.get(namespace) ?? []).filter((d) => d.key !== key);
      next.push({ key, value, by: "you", at: Date.now() });
      memory.set(namespace, next.slice(-5000));
      emit(namespace);
    },
    [namespace],
  );
  const remove = useCallback(
    (key: string) => {
      memory.set(namespace, (memory.get(namespace) ?? []).filter((d) => d.key !== key));
      emit(namespace);
    },
    [namespace],
  );
  return { docs, put, remove, ready: true };
}

// ---- convex ----
function useStoreConvex<T>(namespace: string) {
  const rows = useQuery(api.store.list, { namespace });
  const putM = useMutation(api.store.put);
  const removeM = useMutation(api.store.remove);
  const put = useCallback((key: string, value: T) => void putM({ namespace, key, value, anonId: tabSessionId() }).catch(() => {}), [putM, namespace]);
  const remove = useCallback((key: string) => void removeM({ namespace, key }).catch(() => {}), [removeM, namespace]);
  return { docs: (rows ?? []) as StoreDoc<T>[], put, remove, ready: rows !== undefined };
}

/**
 * A tiny per-namespace document store: public read, signed-in write.
 * Limits: 5,000 docs and 1 MB per namespace, 4 KB per doc, rate-limited writes.
 */
export const useStore: <T = unknown>(namespace: string) => { docs: StoreDoc<T>[]; put: (key: string, value: T) => void; remove: (key: string) => void; ready: boolean } =
  hasConvex ? useStoreConvex : useStoreMock;

function useCounterMock(name: string) {
  const { docs, put } = useStoreMock<number>("counter:" + name);
  const value = docs.find((d) => d.key === "value")?.value ?? 0;
  const bump = useCallback((by = 1) => put("value", value + by), [put, value]);
  return { value, bump };
}
function useCounterConvex(name: string) {
  const rows = useQuery(api.store.list, { namespace: "counter:" + name });
  const bumpM = useMutation(api.store.bump);
  const value = (rows?.find((d) => d.key === "value")?.value as number | undefined) ?? 0;
  const bump = useCallback((by = 1) => void bumpM({ name, by, anonId: tabSessionId() }).catch(() => {}), [bumpM, name]);
  return { value, bump };
}
/** A shared counter. `bump()` increments for everyone; anonymous visitors may press too. */
export const useCounter: (name: string) => { value: number; bump: (by?: number) => void } = hasConvex ? useCounterConvex : useCounterMock;

/** How many people are in the room right now. */
export function useRoomPresence(): { count: number } {
  return { count: useRoomPresenceCount("main") };
}

/** A ticking clock, capped at 4 Hz so blocks can't spin. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), Math.max(250, intervalMs));
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/**
 * A bounded game loop the kit owns, so blocks can animate without ever touching requestAnimationFrame
 * (which is banned in rooms as a CPU-abuse / exfiltration route). The callback gets `dt`, the seconds
 * since the last frame (clamped, so a background tab can't produce a huge jump). Capped at 60fps,
 * cleaned up on unmount, and paused while the tab is hidden. If the callback throws, the loop stops
 * so a broken frame can't spin.
 */
export function useTick(callback: (dt: number) => void, opts: { fps?: number; active?: boolean } = {}): void {
  const fps = Math.max(1, Math.min(60, opts.fps ?? 60));
  const active = opts.active ?? true;
  const cb = useRef(callback);
  useEffect(() => {
    cb.current = callback; // keep the loop calling the latest callback without restarting it
  });
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const step = 1000 / fps;
    let stopped = false;
    const frame = (now: number) => {
      if (stopped) return;
      raf = requestAnimationFrame(frame);
      if (typeof document !== "undefined" && document.hidden) {
        last = now;
        return;
      }
      acc += now - last;
      last = now;
      if (acc < step) return;
      const dt = Math.min(acc, 100) / 1000; // clamp to 100ms so a stall never jumps the world
      acc = 0;
      try {
        cb.current(dt);
      } catch (e) {
        stopped = true;
        cancelAnimationFrame(raf);
        throw e; // let the block's error boundary show it, instead of looping on a bad frame
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [fps, active]);
}

// ---- high scores ----
export type HighScore = { id: string; rank: number; handle: string; score: number; at: number };
type HighScoresApi = { scores: HighScore[]; submit: (score: number, name?: string) => void; ready: boolean };
const mockScores = new Map<string, HighScore[]>();
function useHighScoresMock(game: string, limit = 10): HighScoresApi {
  const [, force] = useState(0);
  const submit = useCallback(
    (score: number, name?: string) => {
      const list = mockScores.get(game) ?? [];
      list.push({ id: String(Math.random()), rank: 0, handle: name?.trim() || "you", score: Math.floor(score), at: Date.now() });
      list.sort((a, b) => b.score - a.score);
      mockScores.set(game, list.slice(0, 50).map((s, i) => ({ ...s, rank: i + 1 })));
      force((n) => n + 1);
    },
    [game],
  );
  return { scores: (mockScores.get(game) ?? []).slice(0, limit), submit, ready: true };
}
function useHighScoresConvex(game: string, limit = 10): HighScoresApi {
  const rows = useQuery(api.scores.top, { game, limit });
  const submitM = useMutation(api.scores.submit);
  const submit = useCallback((score: number, name?: string) => void submitM({ game, score, name, anonId: tabSessionId() }).catch(() => {}), [submitM, game]);
  return { scores: (rows ?? []) as HighScore[], submit, ready: rows !== undefined };
}
/**
 * A leaderboard for a game: the top scores for everyone, and `submit(score, name?)` to post one.
 * One row per person per game (their best); guests can post too. `game` is a kebab-case id, e.g. the block's id.
 */
export const useHighScores: (game: string, limit?: number) => HighScoresApi = hasConvex ? useHighScoresConvex : useHighScoresMock;

