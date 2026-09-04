/**
 * Product analytics, off by default. Set VITE_POSTHOG_KEY (and optionally VITE_POSTHOG_HOST) and events
 * flow to PostHog with no cookies (memory persistence), no session recording, no autocapture, and no
 * extra scripts loaded from anywhere; without the key every call is a no-op. Event names are plain
 * words about what happened on the site, never who did it.
 */
const KEY = (import.meta.env.VITE_POSTHOG_KEY as string | undefined) || "";
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || "https://us.i.posthog.com";

export const analyticsOn = Boolean(KEY);

type Client = { capture: (event: string, props?: Record<string, unknown>) => void };
let client: Client | null = null;
let loading: Promise<void> | null = null;

function load(): Promise<void> {
  if (!KEY) return Promise.resolve();
  if (!loading) {
    loading = import("posthog-js")
      .then(({ default: posthog }) => {
        posthog.init(KEY, {
          api_host: HOST,
          persistence: "memory",
          disable_session_recording: true,
          disable_surveys: true,
          disable_external_dependency_loading: true,
          autocapture: false,
          capture_pageview: false,
          capture_pageleave: true,
        });
        client = posthog;
      })
      .catch(() => {
        /* blocked or offline: analytics is never load-bearing */
      });
  }
  return loading;
}

export function track(event: string, props?: Record<string, unknown>): void {
  if (!KEY) return;
  void load().then(() => client?.capture(event, props));
}

export function trackPageview(path: string): void {
  track("$pageview", { $current_url: path });
}
