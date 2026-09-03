// @ts-check
import { isAllowedNewFile, isAllowedPath, blockIdFromPath } from "./paths.js";
import { findForbidden } from "./forbidden.js";

/** @typedef {"tiny"|"small"|"medium"|"large"} Scope */
/** @type {Record<Scope, number>} */
export const SCOPE_LINE_LIMITS = { tiny: 60, small: 250, medium: 700, large: 1500 };
/** @type {Record<Scope, number>} */
export const MAX_FILES = { tiny: 1, small: 3, medium: 8, large: 20 };
export const MAX_BLOCK_LINES = 400;

/**
 * @typedef {object} ParsedFile
 * @property {string} path
 * @property {string | null} oldPath
 * @property {boolean} isNew
 * @property {boolean} isDeleted
 * @property {boolean} isBinary
 * @property {number} added
 * @property {number} removed
 * @property {string[]} addedLines
 */

/** Minimal unified-diff parser (git diff output). @param {string} diff @returns {ParsedFile[]} */
export function parseUnifiedDiff(diff) {
  /** @type {ParsedFile[]} */
  const files = [];
  /** @type {ParsedFile | null} */
  let cur = null;
  let inHunk = false;
  for (const raw of diff.split("\n")) {
    if (raw.startsWith("diff --git ")) {
      inHunk = false;
      const m = raw.match(/^diff --git a\/(.+?) b\/(.+)$/);
      cur = {
        path: m?.[2] ?? "",
        oldPath: m?.[1] ?? null,
        isNew: false,
        isDeleted: false,
        isBinary: false,
        added: 0,
        removed: 0,
        addedLines: [],
      };
      files.push(cur);
      continue;
    }
    if (!cur) continue;
    if (raw.startsWith("@@")) {
      inHunk = true;
      continue;
    }
    if (raw.startsWith("new file mode")) cur.isNew = true;
    else if (raw.startsWith("deleted file mode")) cur.isDeleted = true;
    else if (raw.startsWith("Binary files") || raw.startsWith("GIT binary patch")) cur.isBinary = true;
    else if (!inHunk && (raw.startsWith("+++ ") || raw.startsWith("--- "))) continue;
    else if (raw.startsWith("+")) {
      cur.added++;
      cur.addedLines.push(raw.slice(1));
    } else if (raw.startsWith("-")) cur.removed++;
  }
  return files;
}

/**
 * @typedef {object} Validation
 * @property {boolean} ok
 * @property {string[]} problems
 * @property {ParsedFile[]} files
 * @property {number} added
 * @property {number} removed
 * @property {string[]} blockIds
 */

/**
 * @param {string} diff
 * @param {Scope} scope
 * @param {{ fullFiles?: Record<string, string> }} [opts]
 * @returns {Validation}
 */
export function validateDiff(diff, scope, opts = {}) {
  const files = parseUnifiedDiff(diff);
  /** @type {string[]} */
  const problems = [];
  if (files.length === 0) problems.push("empty diff");
  if (files.length > MAX_FILES[scope]) problems.push(`too many files for scope ${scope} (${files.length} > ${MAX_FILES[scope]})`);
  let added = 0;
  let removed = 0;
  /** @type {Set<string>} */
  const blockIds = new Set();
  for (const f of files) {
    added += f.added;
    removed += f.removed;
    if (f.isBinary) problems.push(`${f.path}: binary files are not allowed`);
    if (!isAllowedPath(f.path)) problems.push(`${f.path}: outside the editable surface`);
    if (f.oldPath && f.oldPath !== f.path) problems.push(`${f.path}: renames are not allowed`);
    if (f.isNew && !isAllowedNewFile(f.path)) problems.push(`${f.path}: new files may only be blocks`);
    if (f.isDeleted && scope === "tiny") problems.push(`${f.path}: deleting a file is not a tiny change`);
    const id = blockIdFromPath(f.path);
    if (id) blockIds.add(id);
    const hits = findForbidden(f.addedLines.join("\n"));
    for (const h of hits) problems.push(`${f.path}: forbidden (${h.why})`);
    const full = opts.fullFiles?.[f.path];
    if (full) {
      const n = full.split("\n").length;
      if (n > MAX_BLOCK_LINES) problems.push(`${f.path}: ${n} lines, max ${MAX_BLOCK_LINES}`);
      const hits2 = findForbidden(full);
      for (const h of hits2) problems.push(`${f.path}:${h.line}: forbidden (${h.why})`);
    }
  }
  const total = added + removed;
  if (total > SCOPE_LINE_LIMITS[scope]) problems.push(`diff too large for scope ${scope} (${total} > ${SCOPE_LINE_LIMITS[scope]} lines)`);
  return { ok: problems.length === 0, problems: [...new Set(problems)], files, added, removed, blockIds: [...blockIds] };
}
