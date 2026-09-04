import { describe, expect, it } from "vitest";
import { hang, shapeStyle, wallStyle, hashId } from "../../src/core/room/hang";

const c = { gap: 24, radius: 28, padding: 6, columns: 12, shapes: ["card", "soft", "round", "bare"] as const, tilt: 1.2, stagger: 14 };

describe("how a block hangs on the wall", () => {
  it("is stable per id and varies across ids", () => {
    const a = hang({ id: "hello-note", size: "md" }, c);
    const b = hang({ id: "hello-note", size: "md" }, c);
    expect(a).toEqual(b);
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const shapes = new Set(ids.map((id) => hang({ id, size: "md" }, c).shape));
    expect(shapes.size).toBeGreaterThan(1);
    expect(hashId("x")).not.toBe(hashId("y"));
  });
  it("a block's own choices win, clamped to sane ranges", () => {
    const h = hang({ id: "z", size: "sm", shape: "bare", tilt: 9, span: 40, place: { x: 120, y: -5, w: 2 } }, c);
    expect(h.shape).toBe("bare");
    expect(h.tilt).toBe(3);
    expect(h.span).toBe(12);
    expect(h.place).toEqual({ x: 95, y: 0, w: 5 });
  });
  it("size maps to a span of the canvas's columns; the canvas can change the column count", () => {
    expect(hang({ id: "s", size: "sm" }, c).span).toBe(4);
    expect(hang({ id: "s", size: "full" }, c).span).toBe(12);
    expect(hang({ id: "s", size: "md" }, { ...c, columns: 8 }).span).toBe(4);
    expect(hang({ id: "s", size: "md" }, { ...c, columns: 40 }).columns).toBe(16);
  });
  it("a straight, ungapped canvas hands out no tilt and no stagger", () => {
    const h = hang({ id: "q", size: "md" }, { ...c, tilt: 0, stagger: 0 });
    expect(h.tilt).toBe(0);
    expect(h.stagger).toBe(0);
  });
  it("custom shapes become inline styles; presets become classes", () => {
    expect(shapeStyle("round").className).toContain("frame-round");
    const s = shapeStyle({ radius: "40px 8px", clip: "polygon(0 0, 100% 4%, 96% 100%, 2% 92%)", background: "#111", color: "#eee", shadow: "none" });
    expect(s.className).toContain("frame-custom");
    expect(s.style).toMatchObject({ borderRadius: "40px 8px", clipPath: "polygon(0 0, 100% 4%, 96% 100%, 2% 92%)", background: "#111", color: "#eee", boxShadow: "none" });
  });
  it("the wall's variables come from the canvas, with a min height only when something is placed", () => {
    const w = wallStyle({ gap: 40, radius: 0, columns: 6, background: "#000" }, false) as Record<string, string>;
    expect(w["--wall-gap"]).toBe("40px");
    expect(w["--wall-radius"]).toBe("0px");
    expect(w["--wall-cols"]).toBe("6");
    expect(w["--wall-bg"]).toBe("#000");
    expect(w["--wall-min-h"]).toBeUndefined();
    expect((wallStyle({ height: 1500 }, true) as Record<string, string>)["--wall-min-h"]).toBe("1500px");
  });
});
