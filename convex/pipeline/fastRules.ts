/** Who takes the fast path: a tiny change to one existing block or page file, no backend. Pure, unit-tested. */
export const BLOCK_OR_PAGE_FILE_RE = /^src\/rooms\/[a-z0-9-]+\/((blocks|pages)\/[a-z0-9-]+\.tsx|canvas\.ts)$/;

export type FastCandidate = {
  target: { path: string; blockId?: string };
  verdict?: { scope: string; touchesBackend?: boolean } | null;
};

export function fastEligible(r: FastCandidate, cfg: { fastPathEnabled?: boolean }): { ok: true } | { ok: false; reason: string } {
  if (!cfg.fastPathEnabled) return { ok: false, reason: "disabled" };
  if (!r.verdict) return { ok: false, reason: "no verdict" };
  if (r.verdict.scope !== "tiny") return { ok: false, reason: `scope ${r.verdict.scope}` };
  if (r.verdict.touchesBackend) return { ok: false, reason: "backend" };
  if (!r.target.blockId || r.target.blockId === "__new__") return { ok: false, reason: "new file" };
  // (the canvas file, blockId "__canvas__", is a fine fast-path target: one small file)
  if (!BLOCK_OR_PAGE_FILE_RE.test(r.target.path)) return { ok: false, reason: "not a block or page file" };
  return { ok: true };
}
