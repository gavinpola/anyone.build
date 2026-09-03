/** "For your site": validation for notes posted by the ask.js widget. Pure; unit-tested. */

export const NOTE_LIMITS = {
  note: 1000,
  url: 2048,
  path: 512,
  selector: 400,
  elementText: 300,
  html: 2000,
  title: 200,
  viewport: 40,
} as const;

export const SITE_KEY_RE = /^site_[a-f0-9]{20}$/;

export type NoteInput = {
  key: string;
  url: string;
  path: string;
  title?: string;
  selector: string;
  elementText: string;
  html: string;
  note: string;
  viewport?: string;
};

/** `https://example.com` → itself; anything with a path, query, hash, or a non-http scheme → null. */
export function normalizeOrigin(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if ((u.pathname !== "/" && u.pathname !== "") || u.search || u.hash || u.username || u.password) return null;
  return u.origin.toLowerCase();
}

// control characters except tab, newline, carriage return
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

function str(x: unknown, max: number): string | null {
  if (typeof x !== "string" || x.length > max || CONTROL.test(x)) return null;
  return x;
}

type Result = { ok: true; note: NoteInput } | { ok: false; error: string };
const err = (error: string): Result => ({ ok: false, error });

export function validateNote(body: unknown, requestOrigin: string | null): Result {
  const origin = requestOrigin ? normalizeOrigin(requestOrigin) : null;
  if (!origin) return err("missing origin");
  if (!body || typeof body !== "object") return err("bad body");
  const b = body as Record<string, unknown>;

  const key = str(b.key, 40);
  if (!key || !SITE_KEY_RE.test(key)) return err("bad site key");

  const rawNote = str(b.note, NOTE_LIMITS.note);
  const note = rawNote?.trim() ?? "";
  if (note.length < 2) return err("say something");

  const rawUrl = str(b.url, NOTE_LIMITS.url);
  let u: URL;
  try {
    u = new URL(rawUrl ?? "");
  } catch {
    return err("bad url");
  }
  if (u.origin.toLowerCase() !== origin) return err("url origin mismatch");
  const path = (u.pathname + u.search).slice(0, NOTE_LIMITS.path);

  const selector = str(b.selector ?? "", NOTE_LIMITS.selector);
  if (selector === null) return err("bad selector");
  const elementText = str(b.elementText ?? "", NOTE_LIMITS.elementText);
  if (elementText === null) return err("bad element text");
  const html = str(b.html ?? "", NOTE_LIMITS.html);
  if (html === null) return err("bad html");
  const title = b.title === undefined ? undefined : (str(b.title, NOTE_LIMITS.title) ?? undefined);
  const viewport = b.viewport === undefined ? undefined : (str(b.viewport, NOTE_LIMITS.viewport) ?? undefined);

  return {
    ok: true,
    note: {
      key,
      url: u.toString().slice(0, NOTE_LIMITS.url),
      path,
      title,
      selector,
      elementText: elementText.replace(/\s+/g, " ").trim(),
      html,
      note,
      viewport,
    },
  };
}
