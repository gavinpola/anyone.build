import type { ReactNode } from "react";
import { cn } from "@/core/lib/cn";

/**
 * The only way a room may link out. `to` is a bare host+path (no scheme) so room code never
 * contains a URL literal; hosts outside the allowlist render as plain text, so a merged change
 * can never smuggle in a phishing or promo link.
 */
export const LINK_ALLOWLIST = [
  "everyones.lol", "anyone.build",
  "github.com",
  "en.wikipedia.org",
  "developer.mozilla.org",
  "convex.dev",
  "docs.convex.dev",
  "react.dev",
  "vite.dev",
  "tanstack.com",
  "openrouter.ai",
];

export function resolveSafeHref(to: string): string | null {
  const cleaned = to.replace(/^\/+/, "").replace(/^[a-z]+:\/\//i, "");
  try {
    const u = new URL("https://" + cleaned);
    const ok = LINK_ALLOWLIST.some((d) => u.hostname === d || u.hostname.endsWith("." + d));
    if (!ok) return null;
    u.search = "";
    return u.toString();
  } catch {
    return null;
  }
}

export function SafeLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  const href = resolveSafeHref(to);
  if (!href) {
    return (
      <span className={cn("underline decoration-dotted decoration-bad", className)} title="Link not allowed">
        {children}
      </span>
    );
  }
  const host = new URL(href).hostname.replace(/^www\./, "");
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={cn("underline decoration-line-2 underline-offset-2 hover:decoration-accent", className)}>
      {children}
      <span className="placard ml-1 opacity-70">↗ {host}</span>
    </a>
  );
}
