import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight } from "lucide-react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { pickerStore, usePicker } from "@/core/picker/pickerStore";
import { helpStore, useHelpOpen } from "./helpStore";
import { FeedbackForm } from "@/core/feedback/Feedback";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform + navigator.userAgent);

/** Is this the canvas? (the room, or a tile link into it) */
export function useOnRoom() {
  return useRouterState({ select: (s) => s.location.pathname === "/" || s.location.pathname.startsWith("/t/") });
}

/**
 * The one "?": a small card, bottom right. Point, Ask, Ship in three lines; how to point; Change
 * something; More (the FAQ); and feedback on the site itself, typed right here. Both question marks (the header's, the
 * canvas's) open this same card. Closes on Escape, on a press outside, and the moment you start
 * pointing. Anchored inside the canvas's "?" when there is one; a fixed card in the corner elsewhere.
 */
export function HelpPop({ anchored = false }: { anchored?: boolean }) {
  const open = useHelpOpen();
  const navigate = useNavigate();
  const onRoom = useOnRoom();
  const ref = useRef<HTMLDivElement | null>(null);
  const { arming } = usePicker();
  useEffect(() => {
    if (arming) helpStore.close();
  }, [arming]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") helpStore.close();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (ref.current?.contains(t) || t.closest("[data-help-toggle]")) return; // the toggles decide for themselves
      helpStore.close();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [open]);
  if (!open) return null;
  const change = () => {
    helpStore.close();
    if (!onRoom) void navigate({ to: "/" });
    // arm on the next frame, so the card's own closing click never counts as the pick
    setTimeout(() => pickerStore.arm(true), 60);
  };
  const card = (
    <div ref={ref} id="canvas-howto" role="dialog" aria-label="How this works" className={anchored ? "canvas-howto-pop" : "canvas-howto-pop is-fixed"} data-canvas-howto data-help-pop>
      <p className="howto-title">Point. Ask. Watch it ship.</p>
      <ol className="howto-steps">
        <li>
          <span className="num">01</span>
          <span>
            <strong>Point</strong> — tap anything on the wall.
          </span>
        </li>
        <li>
          <span className="num">02</span>
          <span>
            <strong>Ask</strong> — say what should change, in plain words.
          </span>
        </li>
        <li>
          <span className="num">03</span>
          <span>
            <strong>Ship</strong> — it's live in a couple of minutes.
          </span>
        </li>
      </ol>
      <p className="howto-rule">
        Tap an object's <strong>label</strong> to see who made it, change it, or move it. Tap empty ground to add something there.
      </p>
      <p className="mt-2">
        Hold <kbd>⇧</kbd>
        <kbd>{isMac ? "⌘" : "Ctrl"}</kbd> and point at anything to change just that; drag out tiles to work on a space, then pull its edges to resize it. Or press <strong>Change something</strong>.
      </p>
      <p className="mt-2">On a phone: swipe to walk, long-press an object for its sheet.</p>
      <div className="howto-actions">
        <button type="button" className="howto-cta" onClick={change} data-help-change>
          Change something
        </button>
        <Link to="/faq" onClick={() => helpStore.close()} className="howto-more" data-help-more>
          More <ArrowUpRight size={14} aria-hidden />
        </Link>
      </div>
      <div className="howto-feedback" data-help-feedback>
        <FeedbackForm compact />
        <p className="howto-foot">
          <Link to="/leaderboard" hash="feedback" onClick={() => helpStore.close()} className="hover:text-ink hover:underline" data-help-board>
            What others said, and the votes →
          </Link>
        </p>
      </div>
    </div>
  );
  return anchored ? card : createPortal(card, document.body);
}
