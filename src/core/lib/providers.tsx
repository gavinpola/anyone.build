import { useEffect, type ReactNode } from "react";
import { ConvexProvider, ConvexReactClient, useConvexConnectionState } from "convex/react";
import { ConvexBetterAuthProvider, type AuthClient } from "@convex-dev/better-auth/react";
import { authClient } from "@/core/auth/auth-client";

const url = import.meta.env.VITE_CONVEX_URL as string | undefined;
export const convex = url ? new ConvexReactClient(url) : null;
export const hasConvex = Boolean(convex);

/** Marks <html data-convex="ready"> once the socket is up, so tests (and people) can tell. */
function ReadyMarker() {
  const state = useConvexConnectionState();
  useEffect(() => {
    document.documentElement.dataset.convex = state.isWebSocketConnected ? "ready" : "connecting";
  }, [state.isWebSocketConnected]);
  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  if (!convex) return <>{children}</>;
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
