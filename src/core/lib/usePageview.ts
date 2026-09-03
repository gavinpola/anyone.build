import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { api } from "../../../convex/_generated/api";
import { convex, hasConvex } from "./providers";
import { tabSessionId } from "./session";

const sent = new Map<string, number>();

/** Cookieless pageview beacon: one per route per tab per 5 minutes. */
export function usePageview() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    if (!hasConvex || !convex) return;
    const last = sent.get(path) ?? 0;
    if (Date.now() - last < 5 * 60 * 1000) return;
    sent.set(path, Date.now());
    void convex.mutation(api.analytics.pageview, { route: path, sessionHash: tabSessionId() }).catch(() => {});
  }, [path]);
}
