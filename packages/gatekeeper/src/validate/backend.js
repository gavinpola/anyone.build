// @ts-check
/**
 * Deterministic rules for agent-written backend files (convex/rooms/<room>/<file>.ts).
 * Every export must be a roomQuery / roomMutation from the protected kit; nothing else is reachable.
 * Runs in the sandbox, in Convex before commit, and in CI. Mirrored by lint/backend-rules.js.
 */
import { findForbidden } from "./forbidden.js";

export const BACKEND_FILE_RE = /^convex\/rooms\/([a-z0-9-]+)\/([a-z0-9-]+)\.ts$/;
export const MAX_BACKEND_LINES = 300;
export const MAX_BACKEND_EXPORTS = 20;

/** The only imports a room function file may have. */
const IMPORT_ALLOW = [/^\.\.\/\.\.\/kit\/room$/, /^convex\/values$/, /^\.\/[a-z0-9-]+$/];

/** Tokens that have no business in room functions. Word-boundary matched. */
const BANNED = [
  ["process", "process (env, exit, …)"],
  ["fetch", "network access"],
  ["globalThis", "global object"],
  ["self", "global object"],
  ["window", "global object"],
  ["Reflect", "reflection"],
  ["Function", "dynamic code"],
  ["eval", "dynamic code"],
  ["require", "dynamic import"],
  ["import\\.meta", "import.meta"],
  ["internal", "internal function references"],
  ["_generated", "generated API access"],
  ["Convex", "Convex runtime internals"],
  ["syscall", "runtime internals"],
  ["scheduler", "scheduling"],
  ["runAfter", "scheduling"],
  ["runAt", "scheduling"],
  ["setTimeout", "timers"],
  ["setInterval", "timers"],
  ["__proto__", "prototype access"],
  ["prototype", "prototype access"],
  ["constructor", "constructor access"],
  ["use node", "node runtime"],
];

/**
 * @param {string} path
 * @param {string} source
 * @returns {string[]} problems (empty when fine)
 */
export function validateBackendFile(path, source) {
  /** @type {string[]} */
  const problems = [];
  const m = path.replace(/\\/g, "/").match(BACKEND_FILE_RE);
  if (!m) return [`${path}: backend files live at convex/rooms/<room>/<file>.ts`];
  const room = m[1];
  const lines = source.split("\n");
  if (lines.length > MAX_BACKEND_LINES) problems.push(`${path}: ${lines.length} lines, max ${MAX_BACKEND_LINES}`);

  // imports
  const importRe = /^\s*import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm;
  let im;
  while ((im = importRe.exec(source))) {
    const spec = im[1] ?? "";
    if (!IMPORT_ALLOW.some((re) => re.test(spec))) problems.push(`${path}: import "${spec}" is not allowed (only ../../kit/room, convex/values, ./sibling)`);
  }
  if (/\bimport\s*\(/.test(source)) problems.push(`${path}: dynamic import() is not allowed`);

  // exports: only `export const <name> = roomQuery|roomMutation("<room>", {`
  const exportRe = /^\s*export\s+(.*)$/gm;
  let ex;
  let exportCount = 0;
  while ((ex = exportRe.exec(source))) {
    exportCount++;
    const rest = ex[1] ?? "";
    const ok = rest.match(/^const\s+[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*(roomQuery|roomMutation)\(\s*"([a-z0-9-]+)"\s*,\s*\{/);
    if (!ok) problems.push(`${path}: every export must be \`export const name = roomQuery|roomMutation("${room}", {\` (got: ${rest.slice(0, 60)})`);
    else if (ok[2] !== room) problems.push(`${path}: room "${ok[2]}" doesn't match the directory "${room}"`);
  }
  if (exportCount === 0) problems.push(`${path}: nothing exported`);
  if (exportCount > MAX_BACKEND_EXPORTS) problems.push(`${path}: ${exportCount} exports, max ${MAX_BACKEND_EXPORTS}`);

  // banned tokens (comments included on purpose: strings and comments are where injection hides)
  for (const [token, why] of BANNED) {
    const t = String(token);
    const re = new RegExp(`(^|[^A-Za-z0-9_$])${t}([^A-Za-z0-9_$]|$)`, "m");
    if (re.test(source)) problems.push(`${path}: "${t.replace("\\.", ".")}" is not allowed in room functions (${why})`);
  }

  // resource rules
  if (/\bwhile\s*\(\s*true\s*\)/.test(source) || /\bfor\s*\(\s*;\s*;\s*\)/.test(source)) problems.push(`${path}: unbounded loops are not allowed`);
  const listRe = /\.list(?:<[^>]*>)?\s*\(([^)]*)\)/g;
  let li;
  while ((li = listRe.exec(source))) {
    const args = li[1] ?? "";
    const lim = args.match(/limit\s*:\s*(\d+)/);
    if (!lim) problems.push(`${path}: db.list() needs a numeric limit (≤ 200)`);
    else if (Number(lim[1]) > 200) problems.push(`${path}: db.list() limit ${lim[1]} > 200`);
  }

  // the shared bans (secrets, invisible unicode, injection phrases, URLs, …)
  // (the frontend import allowlist doesn't apply here; the backend one above does)
  for (const h of findForbidden(source)) if (!h.why.startsWith("import not allowed")) problems.push(`${path}:${h.line}: forbidden (${h.why})`);

  return [...new Set(problems)];
}
