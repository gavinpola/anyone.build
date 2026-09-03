import { useState, type MouseEvent } from "react";
import { Check, Share2 } from "lucide-react";
import { cn } from "@/core/lib/cn";

/** The link for a thing someone asked for: /c/<request id> for a change, /p/<request id> for a proposal. */
export function shareUrl(kind: "c" | "p", requestId: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://anyone.build";
  return `${origin}/${kind}/${requestId}`;
}

/**
 * Share = the native sheet on a phone, copy-the-link everywhere else. Never a dialog, never a new tab.
 */
export function ShareButton({ url, title, text, compact, className, label = "Share" }: { url: string; title: string; text?: string; compact?: boolean; className?: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const onClick = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const sheet = typeof navigator !== "undefined" && typeof navigator.share === "function" && typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
    if (sheet) {
      try {
        await navigator.share({ url, title, text });
        return;
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return; // they closed the sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 1800);
  };
  const copied = state === "copied";
  return (
    <button
      type="button"
      onClick={onClick}
      data-share={url}
      aria-label={copied ? "Link copied" : `${label}: ${title}`}
      title={copied ? "Link copied" : "Copy a link to this"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border text-[12px] transition-colors",
        compact ? "h-7 px-2" : "h-8 px-3 text-[13px]",
        copied ? "border-ok/50 bg-ok-soft text-ok" : "border-line bg-card text-ink-2 hover:border-line-2 hover:text-ink",
        className,
      )}
    >
      {copied ? <Check size={compact ? 13 : 14} /> : <Share2 size={compact ? 13 : 14} />}
      {compact && !copied ? null : <span>{copied ? "Copied" : state === "failed" ? "Couldn't copy" : label}</span>}
    </button>
  );
}
