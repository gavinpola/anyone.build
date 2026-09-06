import { describe, expect, it } from "vitest";
import { formatCents } from "../../src/core/lib/money";

describe("formatCents", () => {
  it("shows nothing for unknown or zero", () => {
    expect(formatCents(undefined)).toBeNull();
    expect(formatCents(null)).toBeNull();
    expect(formatCents(0)).toBeNull();
    expect(formatCents(-3)).toBeNull();
  });
  it("shows cents under a dollar", () => {
    expect(formatCents(0.4)).toBe("<1¢");
    expect(formatCents(3)).toBe("3¢");
    expect(formatCents(42.6)).toBe("43¢");
  });
  it("shows dollars from a dollar up", () => {
    expect(formatCents(120)).toBe("$1.20");
    expect(formatCents(999)).toBe("$9.99");
    expect(formatCents(1250)).toBe("$13");
  });
});
