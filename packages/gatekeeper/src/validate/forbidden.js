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
  { re: /window\s*\.\s*(location|open|fetch|localStorage|sessionStorage|indexedDB|navigator|postMessage|crypto|top|parent|frames|opener)/, why: "window API" },
  { re: /document\s*\.\s*(write|writeln|createElement|location|domain|execCommand)/, why: "document API" },
  { re: /\bglobalThis\b|\bself\s*\./, why: "global access" },
  { re: /\bnavigator\s*\./, why: "navigator" },
  { re: /\bprocess\s*\.\s*env\b/, why: "process.env" },
  { re: /from\s+["'](convex|@\/core|\.\.\/\.\.\/core|@\/kit\/internal|node:|fs|path|child_process|os|net|http|https|crypto)/, why: "banned import" },
  { re: /require\s*\(/, why: "require" },
  { re: /setInterval\s*\([^,]+,\s*(\d{1,2})\s*\)/, why: "interval under 100ms" },
  { re: /[\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/, why: "invisible unicode" },
  { re: /\\u00[0-9a-f]{2}\\u00[0-9a-f]{2}\\u00[0-9a-f]{2}/i, why: "escaped-string obfuscation" },
  { re: /atob\s*\(|btoa\s*\(|fromCharCode/, why: "encoding helpers" },
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
export function findForbidden(source) {
  /** @type {Array<{ why: string; line: number }>} */
  const hits = [];
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i] ?? "";
    for (const p of FORBIDDEN_PATTERNS) if (p.re.test(l)) hits.push({ why: p.why, line: i + 1 });
    for (const p of SECRET_PATTERNS) if (p.re.test(l)) hits.push({ why: "secret: " + p.why, line: i + 1 });
  }
  return hits;
}
