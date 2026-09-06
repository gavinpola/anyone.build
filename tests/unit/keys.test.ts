import { beforeEach, describe, expect, it } from "vitest";
import { keysStore, routeKey } from "../../src/core/room/keysStore";

const ev = (type: string, key: string, target: EventTarget | null = null) => {
  let prevented = false;
  return { e: { type, key, target, preventDefault: () => (prevented = true) }, prevented: () => prevented };
};

describe("the active object has the keys", () => {
  beforeEach(() => keysStore.reset());
  it("routes keys to the active block's sets only, and keeps arrows from scrolling", () => {
    const dino = new Set<string>();
    const car = new Set<string>();
    keysStore.bind("dino", dino);
    keysStore.bind("car", car);
    expect(routeKey(ev("keydown", "ArrowLeft").e)).toBe(false); // nobody active: the world walks
    keysStore.activate("car");
    const down = ev("keydown", "ArrowLeft");
    expect(routeKey(down.e)).toBe(true);
    expect(down.prevented()).toBe(true);
    expect([...car]).toEqual(["ArrowLeft"]);
    expect(dino.size).toBe(0);
    const w = ev("keydown", "w");
    routeKey(w.e);
    expect(w.prevented()).toBe(false); // letters don't scroll, so they are left alone
    routeKey(ev("keyup", "ArrowLeft").e);
    expect([...car]).toEqual(["w"]);
  });
  it("hands the keys over cleanly: switching or deactivating clears what was held", () => {
    const car = new Set<string>();
    const dino = new Set<string>();
    keysStore.bind("car", car);
    keysStore.bind("dino", dino);
    keysStore.activate("car");
    routeKey(ev("keydown", "ArrowUp").e);
    keysStore.activate("dino");
    expect(car.size).toBe(0);
    routeKey(ev("keydown", " ").e);
    expect([...dino]).toEqual([" "]);
    keysStore.deactivate("car"); // not the active one: nothing happens
    expect(keysStore.get().active).toBe("dino");
    keysStore.deactivate();
    expect(keysStore.get().active).toBeNull();
    expect(dino.size).toBe(0);
  });
  it("leaves fields alone and forgets a set when its block unmounts", () => {
    const car = new Set<string>();
    const unbind = keysStore.bind("car", car);
    keysStore.activate("car");
    const field = { closest: (sel: string) => (sel.includes("input") ? {} : null) } as unknown as EventTarget;
    expect(routeKey(ev("keydown", "a", field).e)).toBe(false);
    unbind();
    expect(routeKey(ev("keydown", "a").e)).toBe(false);
  });
});
