import { describe, expect, it } from "vitest";
import { playtestNote } from "../../packages/gatekeeper/src/playtest-note";

describe("the note a second sandbox pass gets", () => {
  it("names the failed checks and quotes the playtester, without markdown", () => {
    const n = playtestNote({
      failedChecks: ["playtest"],
      comments: ["nice", "**Playtest failed.** The block was mounted alone, played, and looked at:\n\n    playtest dino-game: works=false conf=0.92 · The game never starts.\n\nThe change won't merge until this passes."],
    });
    expect(n.startsWith("Checks that failed on the previous attempt: playtest.")).toBe(true);
    expect(n).toContain("Playtest failed.");
    expect(n).toContain("The game never starts.");
    expect(n).not.toContain("**");
    expect(n).not.toContain("won't merge");
  });
  it("copes with no comment and no names", () => {
    expect(playtestNote({ failedChecks: [], comments: [] })).toBe("The previous attempt's checks did not pass.");
  });
  it("is bounded", () => {
    const n = playtestNote({ failedChecks: ["checks"], comments: ["**Playtest failed.** " + "x".repeat(5000)] });
    expect(n.length).toBeLessThan(1400);
  });
});
