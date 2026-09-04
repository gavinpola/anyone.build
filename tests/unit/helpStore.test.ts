import { describe, expect, it } from "vitest";
import { helpStore } from "../../src/core/help/helpStore";

describe("helpStore", () => {
  it("opens, closes, toggles, and tells subscribers", () => {
    let calls = 0;
    const off = helpStore.subscribe(() => calls++);
    expect(helpStore.get()).toBe(false);
    helpStore.open();
    expect(helpStore.get()).toBe(true);
    helpStore.toggle();
    expect(helpStore.get()).toBe(false);
    helpStore.close();
    expect(calls).toBe(3);
    off();
    helpStore.open();
    expect(calls).toBe(3);
    helpStore.close();
  });
});
