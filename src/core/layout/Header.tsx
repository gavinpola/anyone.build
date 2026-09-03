import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CircleHelp } from "lucide-react";
import { cn } from "@/core/lib/cn";
import { AuthButton } from "@/core/auth/AuthButton";
import { LiveCounters } from "./LiveCounters";
import { PatronSlot } from "@/core/patrons/PatronSlot";
import { HelpPanel } from "@/core/help/HelpPanel";

const nav = [
  { to: "/", label: "Room" },
  { to: "/leaderboard", label: "Leaderboard" },
] as const;

export function Header() {
  const [help, setHelp] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur supports-[backdrop-filter]:bg-paper/70">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-2 px-3 sm:gap-3 sm:px-6">
        <Link to="/" className="text-[19px] font-bold leading-none tracking-tight">
          anyone<span className="text-accent">.</span>build
        </Link>
        <LiveCounters />
        <PatronSlot />
        <nav className="ml-auto flex items-center gap-1">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn("rounded-md px-2 py-1.5 text-[13px] text-ink-2 hover:bg-paper-2 hover:text-ink sm:px-3")}
              activeProps={{ className: "bg-paper-2 text-ink" }}
              activeOptions={{ exact: n.to === "/" }}
            >
              {n.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setHelp(true)}
            className="rounded-md p-1.5 text-ink-2 hover:bg-paper-2 hover:text-ink"
            aria-label="How this works"
            title="How this works"
          >
            <CircleHelp size={18} />
          </button>
        </nav>
        <AuthButton />
      </div>
      <HelpPanel open={help} onClose={() => setHelp(false)} />
    </header>
  );
}
