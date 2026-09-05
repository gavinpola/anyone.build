import { describe, expect, it } from "vitest";
import { friendlyError } from "../../src/core/lib/errors";

describe("friendlyError", () => {
  it("unwraps a Convex server error to its message", () => {
    const e = new Error("[CONVEX M(requests:submit)] [Request ID: 0123abcd4567] Server Error\nUncaught Error: Your change is still building. When it lands, ask for the next one.\n  at handler (../convex/requests.ts:181:11)");
    expect(friendlyError(e)).toBe("Your change is still building. When it lands, ask for the next one.");
  });
  it("shows a validation error's own words", () => {
    const e = new Error("[CONVEX M(requests:submit)] [Request ID: 0123abcd4567] Server Error\nArgumentValidationError: Object contains extra field `foo`");
    expect(friendlyError(e)).toContain("extra field");
  });
  it("keeps the request id when the envelope has nothing readable", () => {
    const e = new Error("[CONVEX M(requests:submit)] [Request ID: 0123abcd4567] Server Error");
    expect(friendlyError(e)).toBe("Something went wrong. Try again. (request 0123abcd)");
  });
  it("names a rate limit plainly", () => {
    const e = new Error('[CONVEX M(requests:submit)] [Request ID: 0123abcd4567] Server Error\nUncaught ConvexError: {"kind":"RateLimited","name":"submitBurst","retryAfter":12000}');
    expect(friendlyError(e)).toBe("Too fast. Wait a moment and try again.");
  });
  it("shows a plain network failure as itself", () => {
    expect(friendlyError(new Error("Failed to fetch"))).toBe("Failed to fetch");
    expect(friendlyError("")).toBe("Something went wrong. Try again.");
    expect(friendlyError(undefined)).toBe("Something went wrong. Try again.");
  });
});
