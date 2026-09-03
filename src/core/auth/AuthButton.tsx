import { LogOut } from "lucide-react";
import { useViewer } from "./useViewer";

export function AuthButton() {
  const v = useViewer();
  if (v.signedIn) {
    return (
      <div className="ml-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-line bg-paper-2 text-[11px] font-medium">
          {v.avatarUrl ? <img src={v.avatarUrl} alt="" className="h-full w-full object-cover" /> : v.handle.slice(0, 2).toUpperCase()}
        </span>
        <span className="hidden text-[13px] sm:inline">@{v.handle}</span>
        <button type="button" onClick={v.signOut} className="rounded p-1 text-muted hover:bg-paper-2 hover:text-ink" aria-label="Sign out">
          <LogOut size={14} />
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={v.signIn}
      className="ml-1 h-9 whitespace-nowrap rounded-md border border-line bg-card px-3 text-[13px] font-medium hover:border-line-2"
    >
      <span className="sm:hidden">Sign in</span>
      <span className="hidden sm:inline">Sign in with GitHub</span>
    </button>
  );
}
