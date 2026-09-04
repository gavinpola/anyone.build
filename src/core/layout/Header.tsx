import { Link } from "@tanstack/react-router";
import { CircleHelp } from "lucide-react";
import { cn } from "@/core/lib/cn";
import { AuthButton } from "@/core/auth/AuthButton";
import { LiveCounters } from "./LiveCounters";
import { PresenceStack } from "./PresenceStack";
import { PatronSlot } from "@/core/patrons/PatronSlot";
import { HelpPanel } from "@/core/help/HelpPanel";
import { helpStore, useHelpOpen } from "@/core/help/helpStore";

const nav = [
  { to: "/", label: "Room" },
  { to: "/leaderboard", label: "Leaderboard" },
] as const;

export function Header() {
  const help = useHelpOpen();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur supports-[backdrop-filter]:bg-paper/70">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-1.5 px-2.5 sm:gap-3 sm:px-6">
        <Link to="/" className="shrink-0 text-[17px] font-bold leading-none tracking-tight sm:text-[19px]">
          anyone<span className="text-accent">.</span>build
        </Link>
        <LiveCounters />
        <PresenceStack />
        <PatronSlot />
        <nav className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn("rounded-md px-1.5 py-1.5 text-[12px] text-ink-2 hover:bg-paper-2 hover:text-ink sm:px-3 sm:text-[13px]")}
              activeProps={{ className: "bg-paper-2 text-ink" }}
              activeOptions={{ exact: n.to === "/" }}
            >
              {n.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => helpStore.open()}
            className="rounded-md p-1.5 text-ink-2 hover:bg-paper-2 hover:text-ink"
            aria-label="How this works"
            title="How this works"
          >
            <CircleHelp size={18} />
          </button>
        </nav>
        <AuthButton />
      </div>
      <HelpPanel open={help} onClose={() => helpStore.close()} />
    </header>
  );
}
