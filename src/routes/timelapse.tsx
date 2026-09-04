import { createFileRoute, Link } from "@tanstack/react-router";
import { TimelapseSection } from "@/core/leaderboard/TimelapseSection";

/** The wall, every hour: its own page. */
export const Route = createFileRoute("/timelapse")({
  component: TimelapsePage,
});

function TimelapsePage() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      <p className="placard mb-4">
        <Link to="/leaderboard" className="hover:text-accent">
          ← leaderboard
        </Link>
      </p>
      <TimelapseSection />
    </div>
  );
}
