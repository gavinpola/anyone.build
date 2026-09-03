import { useBlockProvenance } from "./useBlockProvenance";

export function Placard({ blockId, title, path }: { blockId: string; title: string; path: string }) {
  const p = useBlockProvenance(blockId);
  return (
    <div className="placard flex items-center justify-between gap-3 border-t border-line px-4 py-2">
      <span className="truncate">
        <span className="text-ink-2">{title}</span>
        {p.lastBy ? <span> · by @{p.lastBy}</span> : p.guestTag ? <span> · by guest · {p.guestTag}</span> : <span> · unclaimed</span>}
        {p.changes > 0 ? <span> · {p.changes} {p.changes === 1 ? "change" : "changes"}</span> : null}
      </span>
      <span className="hidden truncate opacity-70 sm:inline" title={path}>
        {path.replace("src/rooms/main/blocks/", "")}
      </span>
    </div>
  );
}
