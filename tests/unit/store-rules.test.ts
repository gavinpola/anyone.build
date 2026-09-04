import { describe, expect, it } from "vitest";
import { canRemove, isOpenNamespace } from "../../convex/lib/storeRules";

/** Who may remove a kit-store doc: authors in plain namespaces; anyone in an open: whiteboard; maintainers anywhere. */
describe("store removal rules", () => {
  const byUser = { byUserId: "u1", byAnonId: undefined };
  const byTab = { byUserId: undefined, byAnonId: "tabA" };

  it("plain namespaces are author-owned", () => {
    expect(canRemove({ namespace: "notes", existing: byUser, viewerId: "u1", trust: 0, anon: undefined })).toBe(true);
    expect(canRemove({ namespace: "notes", existing: byUser, viewerId: "u2", trust: 1, anon: undefined })).toBe(false);
    expect(canRemove({ namespace: "notes", existing: byUser, viewerId: null, trust: 0, anon: "tabA" })).toBe(false);
  });

  it("a signed-out writer owns by tab", () => {
    expect(canRemove({ namespace: "notes", existing: byTab, viewerId: null, trust: 0, anon: "tabA" })).toBe(true);
    expect(canRemove({ namespace: "notes", existing: byTab, viewerId: null, trust: 0, anon: "tabB" })).toBe(false);
    expect(canRemove({ namespace: "notes", existing: byTab, viewerId: null, trust: 0, anon: undefined })).toBe(false);
    expect(canRemove({ namespace: "notes", existing: byTab, viewerId: "u1", trust: 0, anon: undefined })).toBe(false);
  });

  it("maintainers may remove anything", () => {
    expect(canRemove({ namespace: "notes", existing: byTab, viewerId: "m", trust: 3, anon: undefined })).toBe(true);
  });

  it("an open: namespace is a whiteboard: anyone erases anything", () => {
    expect(isOpenNamespace("open:collab-art")).toBe(true);
    expect(isOpenNamespace("collab-art")).toBe(false);
    expect(canRemove({ namespace: "open:collab-art", existing: byUser, viewerId: "u2", trust: 0, anon: undefined })).toBe(true);
    expect(canRemove({ namespace: "open:collab-art", existing: byUser, viewerId: null, trust: 0, anon: "tabZ" })).toBe(true);
    expect(canRemove({ namespace: "open:collab-art", existing: byTab, viewerId: null, trust: 0, anon: "tabB" })).toBe(true);
  });
});
