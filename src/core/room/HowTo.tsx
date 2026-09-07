import { useEffect } from "react";
import { CircleHelp } from "lucide-react";
import { helpStore, useHelpOpen } from "@/core/help/helpStore";
import { HelpPop } from "@/core/help/HelpPop";
import { track } from "@/core/lib/analytics";

/**
 * The "?" in the corner of the canvas. It opens the same card as the header's "?" (helpStore is the
 * one switch), anchored here so the card sits just above the button.
 */
export function HowTo() {
  const open = useHelpOpen();
  // the first landing: the card opens by itself once the world has landed, and never again for this browser
  // (not under automation: the smoke and e2e runs point at the wall, and the card would sit over the map)
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.webdriver) return;
    const t = window.setTimeout(() => helpStore.openFirstVisit(), 700);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="canvas-howto" data-canvas-ui>
      <HelpPop anchored />
      <button
        type="button"
        className="canvas-howto-btn"
        aria-label="How to use the canvas"
        title="How to use the canvas"
        aria-expanded={open}
        aria-controls="canvas-howto"
        data-help-toggle
        onClick={() => {
          if (!helpStore.get()) track("howto_open");
          helpStore.toggle();
        }}
      >
        <CircleHelp size={16} />
      </button>
    </div>
  );
}
