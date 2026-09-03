// @ts-check
/**
 * Text-level forbidden patterns for room files. Mirrors packages/gatekeeper/src/lint/room-rules.js
 * but runs anywhere (sandbox, Convex, CI) without ESLint. Deliberately over-inclusive.
 */
/** @type {Array<{ re: RegExp; why: string }>} */
export const FORBIDDEN_PATTERNS = [
  { re: /dangerouslySetInnerHTML/, why: "dangerouslySetInnerHTML" },
  { re: /\beval\s*\(/, why: "eval" },
  { re: /new\s+Function\s*\(/, why: "new Function" },
  { re: /\bimport\s*\(/, why: "dynamic import" },
  { re: /\bfetch\s*\(/, why: "fetch" },
  { re: /XMLHttpRequest|WebSocket|EventSource|sendBeacon|ServiceWorker|SharedWorker|new\s+Worker/, why: "network/worker API" },
  { re: /localStorage|sessionStorage|indexedDB|document\.cookie|\bcaches\b/, why: "storage/cookies" },
  { re: /<\s*(script|iframe|object|embed|link|meta|base|video|audio|source|img|a)\b/i, why: "banned element" },
  { re: /\b(href|src|srcSet|formAction|action|poster)\s*=/, why: "banned attribute" },
  { re: /https?:\/\//i, why: "URL literal" },
  { re: /\/\/[a-z0-9-]+\.[a-z]{2,}/i, why: "protocol-relative URL" },
  { re: /\burl\s*\(/i, why: "css url()" },
  { re: /javascript\s*:/i, why: "javascript: URL" },
  { re: /\bdata\s*:\s*[a-z]+\//i, why: "data: URL" },
  // Browser globals are off limits entirely: React refs are enough for a block, and every one of
  // these is a route to navigation, storage, or exfiltration (window["fe"+"tch"], location.replace…).
  { re: /\b(window|document|location|top|parent|opener|frames|history|navigator|globalThis|self|screen|frameElement)\b(?!\s*:)/, why: "browser global" },
  { re: /\b(innerHTML|outerHTML|insertAdjacentHTML|createContextualFragment|srcdoc|outerText)\b/, why: "HTML injection sink" },
  { re: /\bnew\s+URL\s*\(|\bURL\s*\.|\bURLSearchParams\b/, why: "URL construction" },
  { re: /\bprocess\s*\.\s*env\b/, why: "process.env" },
  { re: /require\s*\(/, why: "require" },
  { re: /setInterval\s*\([^,]+,\s*(\d{1,3})\s*\)/, why: "interval under 1000ms" },
  { re: /\b(setTimeout|setInterval|requestAnimationFrame|queueMicrotask)\b/, why: "raw timer (use the kit's useNow/useCountdown)" },
  { re: /[\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/, why: "invisible unicode" },
  { re: /\\u00[0-9a-f]{2}\\u00[0-9a-f]{2}\\u00[0-9a-f]{2}/i, why: "escaped-string obfuscation" },
  { re: /atob\s*\(|btoa\s*\(|fromCharCode/, why: "encoding helpers" },
  // Realm escape: [].constructor.constructor("return this")() reaches Function/globalThis with no
  // banned identifier. Ban the property outright (dot or computed) and any string-key obfuscation.
  { re: /\.\s*(constructor|prototype|__proto__)\b/, why: "constructor/prototype access" },
  { re: /\[\s*['"`](constructor|prototype|__proto__)/, why: "constructor via computed access" },
  { re: /\[[^\]]*['"`][^\]]*\+/, why: "computed string-concat property (obfuscation)" },
  { re: /\[\s*`[^`]*\$\{/, why: "computed template-literal property (obfuscation)" },
  { re: /\bcreateElement\s*\(/, why: "React.createElement (use JSX)" },
  { re: /\{\s*\.\.\.[^}]*(src|href|action|dangerouslySetInnerHTML)/, why: "spread props with a banned attribute" },
  { re: /(ignore|disregard|forget|override)\s+(all\s+|any\s+)?(the\s+|your\s+)?(previous|prior|above|earlier|system|these)?\s*(rules|instructions|prompts?|guidelines)/i, why: "prompt-injection text" },
  { re: /(you are now|act as|pretend to be|as the (admin|maintainer|judge|gatekeeper))/i, why: "prompt-injection text" },
];

/** @type {Array<{ re: RegExp; why: string }>} */
export const SECRET_PATTERNS = [
  { re: /sk-or-v1-[a-f0-9]{16,}/i, why: "OpenRouter key" },
  { re: /sk-[a-zA-Z0-9]{20,}/, why: "API key" },
  { re: /gh[pousr]_[A-Za-z0-9]{20,}/, why: "GitHub token" },
  { re: /github_pat_[A-Za-z0-9_]{20,}/, why: "GitHub PAT" },
  { re: /AKIA[0-9A-Z]{16}/, why: "AWS key" },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, why: "private key" },
  { re: /eyJ[a-zA-Z0-9_-]{20,}\.eyJ[a-zA-Z0-9_-]{20,}/, why: "JWT" },
  { re: /polar_[a-z]+_[A-Za-z0-9]{20,}/, why: "Polar token" },
];

/** @param {string} source @returns {Array<{ why: string; line: number }>} */
/** Rooms may import only these. Non-canonical paths (`@/kit/../core`) are rejected by shape, not by resolution. */
const IMPORT_ALLOW = [/^react$/, /^react\/jsx-runtime$/, /^@\/kit$/, /^motion\/react$/, /^lucide-react$/, /^\.\/[a-z0-9-]+$/];
/** @param {string} spec */
export function isAllowedImport(spec) {
  return IMPORT_ALLOW.some((re) => re.test(spec));
}

/** @param {string} source @returns {Array<{ why: string; line: number }>} */
export function findBadImports(source) {
  /** @type {Array<{ why: string; line: number }>} */
  const hits = [];
  const lines = source.split("\n");
  const re = /\b(?:import|export)\b[^"'`;]*?\bfrom\s*["'`]([^"'`]+)["'`]|\bimport\s*["'`]([^"'`]+)["'`]/g;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i] ?? "";
    let m;
    while ((m = re.exec(l))) {
      const spec = m[1] ?? m[2] ?? "";
      if (!isAllowedImport(spec)) hits.push({ why: `import not allowed: ${spec}`, line: i + 1 });
    }
  }
  return hits;
}

/** @param {string} source @returns {Array<{ why: string; line: number }>} */
export function findForbidden(source) {
  /** @type {Array<{ why: string; line: number }>} */
  const hits = [];
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i] ?? "";
    for (const p of FORBIDDEN_PATTERNS) if (p.re.test(l)) hits.push({ why: p.why, line: i + 1 });
    for (const p of SECRET_PATTERNS) if (p.re.test(l)) hits.push({ why: "secret: " + p.why, line: i + 1 });
  }
  // A second pass over whitespace-collapsed source: catches patterns split across lines to dodge the
  // per-line check (e.g. `eval\n(...)`, a multi-line import, `[].constructor .constructor`).
  const flat = source.replace(/\s+/g, " ");
  const seen = new Set(hits.map((h) => h.why));
  for (const p of FORBIDDEN_PATTERNS) if (!seen.has(p.why) && p.re.test(flat)) hits.push({ why: p.why, line: 0 });
  hits.push(...findBadImports(source));
  hits.push(...findBadImports(flat).filter((h) => !hits.some((x) => x.why === h.why)));
  return hits;
}
