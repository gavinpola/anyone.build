/**
 * Turn a thrown thing into one honest line for the person. Convex wraps server errors as
 * "[CONVEX M(fn)] [Request ID: …] Server Error\nUncaught Error: <message>\n at …"; we want <message>.
 * Anything else shows as itself, trimmed, so a real failure is never hidden behind "something went
 * wrong" (that line is only for a truly empty error).
 */
export function friendlyError(e: unknown, fallback = "Something went wrong. Try again."): string {
  const raw = e instanceof Error ? e.message : typeof e === "string" ? e : e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "";
  const m = raw.match(/Uncaught (?:Error|ConvexError): ([^\n]+)/) ?? raw.match(/(?:Validation|Argument)?Error: ([^\n]+)/);
  let msg = (m?.[1] ?? raw).trim();
  // a Convex envelope with nothing readable inside: keep the request id so the failure can be found
  if (/^\[CONVEX/.test(msg)) {
    const id = raw.match(/Request ID: ([a-f0-9]+)/)?.[1];
    return id ? `${fallback} (request ${id.slice(0, 8)})` : fallback;
  }
  if (!msg || /^Server Error$/.test(msg)) return fallback;
  msg = msg.replace(/\s+at\s+.*$/s, "").replace(/^\{.*"kind":"RateLimited".*\}$/s, "Too fast. Wait a moment and try again.");
  return msg.slice(0, 200);
}
