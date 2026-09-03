import { useSyncExternalStore } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { hasConvex } from "@/core/lib/providers";
import { authClient, devAnonAuth } from "./auth-client";

export type ViewerState = {
  signedIn: boolean;
  loading: boolean;
  handle: string;
  avatarUrl: string | null;
  trust: number;
  signIn: () => void;
  signOut: () => void;
};

// --- mock (no backend configured) ---
let mockSignedIn = false;
const ls = new Set<() => void>();
const sub = (l: () => void) => {
  ls.add(l);
  return () => ls.delete(l);
};
const get = () => mockSignedIn;
function useViewerMock(): ViewerState {
  const signedIn = useSyncExternalStore(sub, get, get);
  const flip = (v: boolean) => {
    mockSignedIn = v;
    for (const l of ls) l();
  };
  return { signedIn, loading: false, handle: signedIn ? "you" : "anon", avatarUrl: null, trust: signedIn ? 1 : 0, signIn: () => flip(true), signOut: () => flip(false) };
}

// --- convex + better auth ---
function useViewerConvex(): ViewerState {
  const me = useQuery(api.users.viewer, {});
  const touch = useMutation(api.users.touch);
  const signedIn = Boolean(me);
  return {
    signedIn,
    loading: me === undefined,
    handle: me?.handle ?? "anon",
    avatarUrl: me?.avatarUrl ?? null,
    trust: me?.trust ?? 0,
    signIn: () => {
      if (!authClient) return;
      if (devAnonAuth) {
        void authClient.signIn.anonymous();
        return;
      }
      void authClient.signIn.social({ provider: "github", callbackURL: window.location.href });
    },
    signOut: () => {
      void touch({}).catch(() => {});
      void authClient?.signOut();
    },
  };
}

export const useViewer: () => ViewerState = hasConvex ? useViewerConvex : useViewerMock;
