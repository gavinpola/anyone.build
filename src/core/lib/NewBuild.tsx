import { useNewBuild } from "./useNewBuild";

/** "New on the wall · reload": shown when a change has landed since this tab loaded. */
export function NewBuild({ className = "" }: { className?: string }) {
  const stale = useNewBuild();
  if (!stale) return null;
  return (
    <button type="button" onClick={() => location.reload()} className={"new-build " + className} data-new-build title="A change landed since you opened this tab">
      <span className="live-dot" aria-hidden />
      New on the wall · reload
    </button>
  );
}
