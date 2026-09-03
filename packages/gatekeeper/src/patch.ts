/**
 * A minimal unified diff (git style) between two versions of one file. Used by the fast path, which
 * rewrites a single file in one model call and has no git to diff with. Files are small (blocks are
 * capped at 400 lines), so a plain LCS is fine. Output parses with validate/diff.js and reads like
 * `git diff` for the reviewers.
 */
type Op = { t: " " | "-" | "+"; line: string };

function lcsOps(a: string[], b: string[]): Op[] {
  const n = a.length;
  const m = b.length;
  // dp[i][j] = LCS length of a[i..], b[j..]
  const dp: Uint16Array[] = [];
  for (let i = 0; i <= n; i++) dp.push(new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ t: " ", line: a[i]! });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      ops.push({ t: "-", line: a[i]! });
      i++;
    } else {
      ops.push({ t: "+", line: b[j]! });
      j++;
    }
  }
  while (i < n) ops.push({ t: "-", line: a[i++]! });
  while (j < m) ops.push({ t: "+", line: b[j++]! });
  return ops;
}

function splitLines(text: string): string[] {
  const lines = text.split("\n");
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** Returns "" when the texts are identical. `context` lines of context around each change, hunks merged when close. */
export function unifiedDiff(path: string, oldText: string, newText: string, context = 3): string {
  if (oldText === newText) return "";
  const a = splitLines(oldText);
  const b = splitLines(newText);
  if (a.length > 4000 || b.length > 4000) throw new Error("unifiedDiff: file too large");
  const ops = lcsOps(a, b);
  const changed = ops.map((o, k) => (o.t !== " " ? k : -1)).filter((k) => k >= 0);
  if (changed.length === 0) return "";

  // group changes into hunks: a gap of more than 2*context unchanged lines starts a new hunk
  const groups: Array<[number, number]> = [];
  let start = changed[0]!;
  let end = changed[0]!;
  for (const k of changed.slice(1)) {
    if (k - end > 2 * context) {
      groups.push([start, end]);
      start = k;
    }
    end = k;
  }
  groups.push([start, end]);

  const out = [`diff --git a/${path} b/${path}`, `--- a/${path}`, `+++ b/${path}`];
  // line numbers in old/new at each op index
  const oldAt: number[] = [];
  const newAt: number[] = [];
  let oi = 1;
  let ni = 1;
  for (const o of ops) {
    oldAt.push(oi);
    newAt.push(ni);
    if (o.t !== "+") oi++;
    if (o.t !== "-") ni++;
  }
  for (const [s, e] of groups) {
    const from = Math.max(0, s - context);
    const to = Math.min(ops.length - 1, e + context);
    let oldCount = 0;
    let newCount = 0;
    const body: string[] = [];
    for (let k = from; k <= to; k++) {
      const o = ops[k]!;
      if (o.t !== "+") oldCount++;
      if (o.t !== "-") newCount++;
      body.push(o.t + o.line);
    }
    out.push(`@@ -${oldAt[from]},${oldCount} +${newAt[from]},${newCount} @@`, ...body);
  }
  return out.join("\n") + "\n";
}
