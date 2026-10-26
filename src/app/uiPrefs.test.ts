import { describe, expect, it } from "vitest";
import { nextScale, zoomDirection } from "./uiPrefs";

describe("nextScale", () => {
  it("steps by ten within range and resets on Ctrl 0", () => {
    expect(nextScale(100, 1)).toBe(110);
    expect(nextScale(100, -1)).toBe(90);
    expect(nextScale(150, 1)).toBe(150);
    expect(nextScale(80, -1)).toBe(80);
    expect(nextScale(125, 0)).toBe(100);
  });
});

describe("zoomDirection", () => {
  const key = (k: string, extra: Partial<KeyboardEvent> = {}) =>
    ({ ctrlKey: true, metaKey: false, altKey: false, key: k, code: "", ...extra }) as KeyboardEvent;

  it("maps Ctrl +, Ctrl - and Ctrl 0", () => {
    expect(zoomDirection(key("+"))).toBe(1);
    expect(zoomDirection(key("="))).toBe(1);
    expect(zoomDirection(key("-"))).toBe(-1);
    expect(zoomDirection(key("0"))).toBe(0);
  });

  it("ignores keys without Ctrl, or with Alt", () => {
    expect(zoomDirection(key("+", { ctrlKey: false }))).toBeNull();
    expect(zoomDirection(key("+", { altKey: true }))).toBeNull();
    expect(zoomDirection(key("a"))).toBeNull();
  });
});
