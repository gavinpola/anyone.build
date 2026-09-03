import { PatronColumn } from "@/core/patrons/PatronColumn";
import { BuildersSection } from "./BuildersSection";
import { ChangesSection } from "./ChangesSection";
import { ProposalsSection } from "./ProposalsSection";
import { FocusBar } from "@/core/share/FocusBar";

export function LeaderboardPage({ focus }: { focus?: string } = {}) {
  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6">
      {focus ? <FocusBar id={focus} kind="p" /> : null}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="flex min-w-0 flex-col gap-10">
          <BuildersSection />
          <ProposalsSection />
          <ChangesSection />
        </div>
        <PatronColumn />
      </div>
    </div>
  );
}
