import { describe, expect, it } from "vitest";
import { NOTE_LIMITS, normalizeOrigin, validateNote } from "../../convex/lib/notes";

const KEY = "site_" + "a".repeat(20);
const good = {
  key: KEY,
  url: "https://example.com/pricing?plan=plus#top",
  title: "Pricing",
  selector: "main > section:nth-of-type(2) > article:nth-of-type(2) > h2",
  elementText: "  Plus \n plan  ",
  html: "<h2>Plus</h2>",
  note: "The Plus price says $6 but checkout charges $7.",
  viewport: "1280x800",
};

describe("normalizeOrigin", () => {
  it("keeps only scheme + host, lowercased", () => {
    expect(normalizeOrigin("https://Example.com/")).toBe("https://example.com");
    expect(normalizeOrigin(" http://localhost:5173 ")).toBe("http://localhost:5173");
  });
  it("refuses paths, queries, credentials, and other schemes", () => {
    expect(normalizeOrigin("https://example.com/app")).toBeNull();
    expect(normalizeOrigin("https://example.com/?x=1")).toBeNull();
    expect(normalizeOrigin("https://u:p@example.com")).toBeNull();
    expect(normalizeOrigin("ftp://example.com")).toBeNull();
    expect(normalizeOrigin("javascript:alert(1)")).toBeNull();
    expect(normalizeOrigin("not a url")).toBeNull();
  });
});

describe("validateNote", () => {
  it("accepts a well-formed note from the matching origin", () => {
    const r = validateNote(good, "https://example.com");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.note.path).toBe("/pricing?plan=plus");
    expect(r.note.elementText).toBe("Plus plan");
    expect(r.note.note).toBe(good.note);
    expect(r.note.viewport).toBe("1280x800");
  });
  it("needs an Origin header that is a real origin", () => {
    expect(validateNote(good, null)).toEqual({ ok: false, error: "missing origin" });
    expect(validateNote(good, "garbage")).toEqual({ ok: false, error: "missing origin" });
  });
  it("refuses a page URL from another origin", () => {
    expect(validateNote(good, "https://other.com")).toEqual({ ok: false, error: "url origin mismatch" });
    expect(validateNote({ ...good, url: "https://evil.com/x" }, "https://example.com")).toEqual({ ok: false, error: "url origin mismatch" });
  });
  it("checks the key shape and the note", () => {
    expect(validateNote({ ...good, key: "site_xyz" }, "https://example.com").ok).toBe(false);
    expect(validateNote({ ...good, note: " " }, "https://example.com")).toEqual({ ok: false, error: "say something" });
    expect(validateNote({ ...good, note: "x".repeat(NOTE_LIMITS.note + 1) }, "https://example.com").ok).toBe(false);
    expect(validateNote({ ...good, note: "hithere" }, "https://example.com").ok).toBe(false);
    expect(validateNote({ ...good, note: "line one\nline two\ttab" }, "https://example.com").ok).toBe(true);
  });
  it("caps every optional field and tolerates missing ones", () => {
    const r = validateNote({ key: KEY, url: "https://example.com", note: "Make the button bigger" }, "https://example.com");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.note.selector).toBe("");
    expect(r.note.html).toBe("");
    expect(r.note.title).toBeUndefined();
    expect(validateNote({ ...good, html: "<p>" + "x".repeat(NOTE_LIMITS.html) }, "https://example.com").ok).toBe(false);
    const longTitle = validateNote({ ...good, title: "t".repeat(NOTE_LIMITS.title + 1) }, "https://example.com");
    expect(longTitle.ok && longTitle.note.title).toBeUndefined();
  });
  it("rejects non-object bodies", () => {
    expect(validateNote("nope", "https://example.com").ok).toBe(false);
    expect(validateNote(null, "https://example.com").ok).toBe(false);
  });
});
