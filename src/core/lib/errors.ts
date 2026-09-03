/** Turn a Convex/HTTP error into the one line we actually wrote for people. */
export function friendlyError(e: unknown, fallback = "Something went wrong. Try again."): string {
  const raw = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  const m = raw.match(/Uncaught (?:Error|ConvexError): ([^\n]+)/) ?? raw.match(/Error: ([^\n]+)/);
  const msg = (m?.[1] ?? raw).trim();
  if (!msg || /^\[CONVEX|Server Error$/.test(msg)) return fallback;
  return msg.replace(/\s+at\s+.*$/s, "").slice(0, 200);
}
