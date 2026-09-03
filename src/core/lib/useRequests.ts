import { useSyncExternalStore } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import * as mock from "./mockPipeline";
import type { FeedRequest, Target } from "./types";
import { hasConvex, convex } from "./providers";
import { guestId } from "./session";

/** Feed data + actions. Backed by Convex when configured, by the local mock otherwise. */
function useRequestsMock(): FeedRequest[] {
  return useSyncExternalStore(mock.subscribe, mock.getSnapshot, mock.getSnapshot);
}
function useRequestsConvex(): FeedRequest[] {
  const active = useQuery(api.requests.active, { guestId: guestId() });
  const landed = useQuery(api.requests.landed, { limit: 30, guestId: guestId() });
  return [...((active ?? []) as unknown as FeedRequest[]), ...((landed ?? []) as unknown as FeedRequest[])];
}
export const useRequests: () => FeedRequest[] = hasConvex ? useRequestsConvex : useRequestsMock;

export async function submitRequest(input: { prompt: string; target: Target; handle: string; avatarUrl: string | null; turnstileTicket?: string }): Promise<string> {
  if (!hasConvex || !convex) return mock.submit(input);
  const { blockTitle: _t, ...target } = input.target;
  const id = await convex.mutation(api.requests.submit, { prompt: input.prompt, target: { ...target, blockTitle: input.target.blockTitle }, guestId: guestId(), turnstileTicket: input.turnstileTicket });
  return id as string;
}

export function cancelRequest(id: string) {
  if (!hasConvex || !convex) return mock.cancel(id);
  void convex.mutation(api.requests.cancel, { id: id as Id<"requests">, guestId: guestId() });
}

export function plusOneRequest(id: string) {
  if (!hasConvex || !convex) return mock.plusOne(id);
  void convex.mutation(api.requests.plusOne, { id: id as Id<"requests">, guestId: guestId() });
}

export function useRequest(id: string | null): FeedRequest | null {
  const all = useRequests();
  return id ? (all.find((r) => r.id === id) ?? null) : null;
}

export function useSubmitMutation() {
  return useMutation(api.requests.submit);
}
