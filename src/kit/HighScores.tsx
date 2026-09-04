import { useHighScores } from "./hooks";
import { cn } from "@/core/lib/cn";

/** A small leaderboard list for a game. Pair with useHighScores(game).submit(score) when a round ends. */
export function HighScores({ game, limit = 5, title = "High scores", className }: { game: string; limit?: number; title?: string; className?: string }) {
  const { scores, ready } = useHighScores(game, limit);
  return (
    <div className={cn("rounded-lg border border-line/70 bg-paper-2/60 px-3 py-2", className)} data-high-scores={game}>
      <p className="placard smallcaps">{title}</p>
      {!ready ? (
        <p className="mt-1 text-[12px] text-muted">…</p>
      ) : scores.length === 0 ? (
        <p className="mt-1 text-[12px] text-muted">No scores yet. Be the first.</p>
      ) : (
        <ol className="mt-1 flex flex-col gap-0.5 text-[13px]">
          {scores.map((s) => (
            <li key={s.id} className="flex items-baseline gap-2">
              <span className="w-4 text-right font-mono text-[11px] text-muted">{s.rank}</span>
              <span className="min-w-0 flex-1 truncate">{s.handle}</span>
              <span className="font-mono tabular-nums">{s.score.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
