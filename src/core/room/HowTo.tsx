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
