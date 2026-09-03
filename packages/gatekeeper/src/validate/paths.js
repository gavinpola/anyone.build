// @ts-check
/** The agent-editable surface. Everything else is read-only and any diff touching it is rejected. */
export const ALLOWED_PREFIXES = ["src/rooms/"];
export const ALLOWED_EXTENSIONS = [".tsx", ".ts", ".css", ".md"];
export const BLOCK_DIR_RE = /^src\/rooms\/[a-z0-9-]+\/blocks\/[a-z0-9-]+\.tsx$/;
export const FORBIDDEN_NAME_RE = /(^|\/)(\.|node_modules|_generated)|\.\.|\0/;

/** @param {string} p */
export function isAllowedPath(p) {
  const norm = p.replace(/\\/g, "/").replace(/^\.\//, "");
  if (FORBIDDEN_NAME_RE.test(norm)) return false;
  if (!ALLOWED_PREFIXES.some((pre) => norm.startsWith(pre))) return false;
  if (!ALLOWED_EXTENSIONS.some((ext) => norm.endsWith(ext))) return false;
  return true;
}

/** New files may only be blocks. @param {string} p */
export function isAllowedNewFile(p) {
  return isAllowedPath(p) && BLOCK_DIR_RE.test(p);
}

/** @param {string} p @returns {string | null} */
export function blockIdFromPath(p) {
  const m = p.match(/\/blocks\/([a-z0-9-]+)\.tsx$/);
  return m?.[1] ?? null;
}
