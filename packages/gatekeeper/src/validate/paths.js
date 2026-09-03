// @ts-check
/** The agent-editable surface. Everything else is read-only and any diff touching it is rejected. */
export const ALLOWED_PREFIXES = ["src/rooms/"];
export const ALLOWED_EXTENSIONS = [".tsx", ".ts", ".css", ".md"];
export const BLOCK_DIR_RE = /^src\/rooms\/[a-z0-9-]+\/blocks\/[a-z0-9-]+\.tsx$/;
/** Pages are routes under /r/<room>/<slug>, one file each. */
export const PAGE_FILE_RE = /^src\/rooms\/[a-z0-9-]+\/pages\/[a-z0-9-]+\.tsx$/;
export const FORBIDDEN_NAME_RE = /(^|\/)(\.|node_modules|_generated)|\.\.|\0/;

/** @param {string} p */
export function isAllowedPath(p) {
  const norm = p.replace(/\\/g, "/").replace(/^\.\//, "");
  if (FORBIDDEN_NAME_RE.test(norm)) return false;
  if (!ALLOWED_PREFIXES.some((pre) => norm.startsWith(pre))) return false;
  if (!ALLOWED_EXTENSIONS.some((ext) => norm.endsWith(ext))) return false;
  return true;
}

/** New files may only be blocks or pages. @param {string} p */
export function isAllowedNewFile(p) {
  return isAllowedPath(p) && (BLOCK_DIR_RE.test(p) || PAGE_FILE_RE.test(p));
}

/** @param {string} p @returns {string | null} */
export function blockIdFromPath(p) {
  const m = p.match(/\/blocks\/([a-z0-9-]+)\.tsx$/);
  if (m) return m[1] ?? null;
  const pg = p.match(/\/pages\/([a-z0-9-]+)\.tsx$/);
  return pg ? `page:${pg[1]}` : null;
}
