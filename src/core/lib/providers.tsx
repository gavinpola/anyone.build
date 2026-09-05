import { useEffect, type ReactNode } from "react";
import { ConvexProvider, ConvexReactClient, useConvexConnectionState, useQuery } from "convex/react";
import { ConvexBetterAuthProvider, type AuthClient } from "@convex-dev/better-auth/react";
import { authClient } from "@/core/auth/auth-client";

const url = import.meta.env.VITE_CONVEX_URL as string | undefined;
export const convex = url ? new ConvexReactClient(url) : null;
export const hasConvex = Boolean(convex);
// Without a URL (CI's playtest build, a fork) the app still needs a provider in the tree, or every
// useQuery/useMutation in a component throws before the mock hooks get a say. This client points at
// nothing and is never asked anything the mock paths don't already answer.
const offline = convex ?? new ConvexReactClient("https://no-convex.invalid", { skipConvexDeploymentUrlCheck: true, unsavedChangesWarning: false });

/** Marks <html data-convex="ready"> once the socket is up, so tests (and people) can tell. */
function ReadyMarker() {
  const state = useConvexConnectionState();
  useEffect(() => {
    document.documentElement.dataset.convex = state.isWebSocketConnected ? "ready" : "connecting";
  }, [state.isWebSocketConnected]);
  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  if (!convex) return <ConvexProvider client={offline}>{children}</ConvexProvider>;
  if (authClient) {
    return (
      <ConvexBetterAuthProvider client={convex} authClient={authClient as unknown as AuthClient}>
        <ReadyMarker />
        {children}
      </ConvexBetterAuthProvider>
    );
  }
  return (
    <ConvexProvider client={convex}>
      <ReadyMarker />
      {children}
    </ConvexProvider>
  );
}

/**
 * useQuery that is simply undefined when there is no Convex client (a build without VITE_CONVEX_URL:
 * CI's playtest, a fork). Chosen once at module load, so hooks stay unconditional.
 */
function useQueryNever(): undefined {
  return undefined;
}
export const useQuerySafe: typeof useQuery = hasConvex ? useQuery : (useQueryNever as unknown as typeof useQuery);

