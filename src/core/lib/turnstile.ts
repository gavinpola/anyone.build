import { useCallback, useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile for signed-out askers, on only when VITE_TURNSTILE_SITE_KEY is set. The widget
 * renders in "interaction-only" mode (invisible unless Cloudflare wants a click), hands back a token,
 * and the server swaps that token for a single-use ticket that submit() consumes. Without the key
 * nothing loads and getToken() answers null, which the server treats as "no check configured".
 */
const SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || "";
export const turnstileOn = Boolean(SITE_KEY);

type Turnstile = {
  render: (el: HTMLElement, opts: { sitekey: string; appearance?: string; callback?: (token: string) => void; "error-callback"?: () => void; "expired-callback"?: () => void }) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let scriptP: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptP) {
    scriptP = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Turnstile failed to load"));
      document.head.appendChild(s);
    });
  }
  return scriptP;
}

export function useTurnstile(enabled: boolean) {
  const host = useRef<HTMLDivElement | null>(null);
  const widget = useRef<string | null>(null);
  const token = useRef<string | null>(null);
  const waiters = useRef<Array<(t: string | null) => void>>([]);

  useEffect(() => {
    if (!enabled || !turnstileOn) return;
    let alive = true;
    void loadScript()
      .then(() => {
        if (!alive || !host.current || !window.turnstile || widget.current) return;
        widget.current = window.turnstile.render(host.current, {
          sitekey: SITE_KEY,
          appearance: "interaction-only",
          callback: (t) => {
            token.current = t;
            for (const w of waiters.current.splice(0)) w(t);
          },
          "expired-callback": () => {
            token.current = null;
          },
          "error-callback": () => {
            for (const w of waiters.current.splice(0)) w(null);
          },
        });
      })
      .catch(() => {
        for (const w of waiters.current.splice(0)) w(null);
      });
    return () => {
      alive = false;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
      token.current = null;
    };
  }, [enabled]);

  /** The current token (fresh one requested after use); null when the check is off or failed. */
  const getToken = useCallback(async (): Promise<string | null> => {
    if (!enabled || !turnstileOn) return null;
    if (token.current) {
      const t = token.current;
      token.current = null;
      if (widget.current && window.turnstile) window.turnstile.reset(widget.current); // tokens are single-use
      return t;
    }
    return new Promise<string | null>((resolve) => {
      waiters.current.push(resolve);
      setTimeout(() => {
        const i = waiters.current.indexOf(resolve);
        if (i >= 0) {
          waiters.current.splice(i, 1);
          resolve(null);
        }
      }, 12_000);
    });
  }, [enabled]);

  // a callback ref, so JSX never touches the ref object during render
  const attach = useCallback((el: HTMLDivElement | null) => {
    host.current = el;
  }, []);

  return { attach, getToken };
}
