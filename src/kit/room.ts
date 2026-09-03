import { useCallback } from "react";
import { makeFunctionReference } from "convex/server";
import { useMutation, useQuery } from "convex/react";
import { hasConvex } from "@/core/lib/providers";
import { useRoomId } from "./room-context";

/**
 * Hooks for a room's own backend functions (convex/rooms/<room>/<file>.ts, defined with roomQuery /
 * roomMutation). The name is "<file>:<fn>". Strings on purpose: a typed `api` import would let a
 * block call any function in the app with the viewer's session.
 */
const FN_RE = /^[a-z0-9-]+:[a-zA-Z][a-zA-Z0-9_]*$/;
type Args = Record<string, unknown>;

function refFor<T extends "query" | "mutation">(room: string, fn: string) {
  if (!FN_RE.test(fn)) throw new Error(`Bad room function name: ${fn}`);
  const [file, name] = fn.split(":") as [string, string];
  return makeFunctionReference<T, Args, unknown>(`rooms/${room}/${file}:${name}`);
}

function useRoomQueryConvex<T>(fn: string, args: Args | "skip"): T | undefined {
  const room = useRoomId();
  const ref = refFor<"query">(room, fn);
  return useQuery(ref, args === "skip" ? "skip" : args) as T | undefined;
}
function useRoomQueryMock<T>(): T | undefined {
  return undefined;
}

function useRoomMutationConvex(fn: string): (args?: Args) => Promise<unknown> {
  const room = useRoomId();
  const m = useMutation(refFor<"mutation">(room, fn));
  return useCallback((args?: Args) => m(args ?? {}), [m]);
}
function useRoomMutationMock(): (args?: Args) => Promise<unknown> {
  return useCallback(async () => undefined, []);
}

/** Subscribe to one of the room's queries. `undefined` while loading, or without a backend. */
export const useRoomQuery: <T = unknown>(fn: string, args?: Args | "skip") => T | undefined = hasConvex
  ? (fn, args = {}) => useRoomQueryConvex(fn, args)
  : () => useRoomQueryMock();

/** Call one of the room's mutations. Throws the function's error message (e.g. "Sign in to do that."). */
export const useRoomMutation: (fn: string) => (args?: Args) => Promise<unknown> = hasConvex ? useRoomMutationConvex : useRoomMutationMock;
