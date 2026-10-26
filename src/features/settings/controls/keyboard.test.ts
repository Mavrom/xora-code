import { describe, expect, it } from "vitest";
import { parseClamped, stepIndex } from "./keyboard";

describe("stepIndex", () => {
  it("wraps with the arrows and jumps with Home/End", () => {
    expect(stepIndex("ArrowRight", 2, 3)).toBe(0);
    expect(stepIndex("ArrowDown", 0, 3)).toBe(1);
    expect(stepIndex("ArrowLeft", 0, 3)).toBe(2);
    expect(stepIndex("ArrowUp", 1, 3)).toBe(0);
    expect(stepIndex("Home", 2, 3)).toBe(0);
    expect(stepIndex("End", 0, 3)).toBe(2);
  });

  it("ignores other keys and empty lists", () => {
    expect(stepIndex("Enter", 0, 3)).toBeNull();
    expect(stepIndex("ArrowDown", 0, 0)).toBeNull();
  });
});

describe("parseClamped", () => {
  it("parses and clamps", () => {
    expect(parseClamped(" 15 ", 10, 24)).toBe(15);
    expect(parseClamped("3", 10, 24)).toBe(10);
    expect(parseClamped("40px", 10, 24)).toBe(24);
    expect(parseClamped("abc", 10, 24)).toBeNull();
  });
});
