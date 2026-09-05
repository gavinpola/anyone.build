/**
 * What a second sandbox pass is told when the first attempt's pull request went red: which checks
 * failed, and the playtester's own words (the CI comment that starts "**Playtest failed.**"). Plain
 * text, bounded, no markdown, no requester text.
 */
export function playtestNote(opts: { failedChecks: string[]; comments: string[] }): string {
  const checks = opts.failedChecks.filter(Boolean);
  const comment = [...opts.comments].reverse().find((c) => /\*\*Playtest failed\.\*\*/.test(c)) ?? "";
  const body = comment
    .replace(/\*\*Playtest failed\.\*\*/, "Playtest failed.")
    .replace(/The change won't merge until this passes\./, "")
    .replace(/[`*_#>]/g, "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, 1200);
  const head = checks.length ? `Checks that failed on the previous attempt: ${checks.join(", ")}.` : "The previous attempt's checks did not pass.";
  return body ? `${head}\n${body}` : head;
}
