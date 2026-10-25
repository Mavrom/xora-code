import { describe, expect, it } from "vitest";
import { describeShortcut, detectPlatform, formatShortcut } from "./keys";

const labels = (shortcut: string, platform: "mac" | "other") =>
  formatShortcut(shortcut, platform).map((cap) => cap.label);

describe("detectPlatform", () => {
  it("recognises macOS from platform or user agent", () => {
    expect(detectPlatform({ platform: "MacIntel" })).toBe("mac");
    expect(detectPlatform({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)" })).toBe(
      "mac",
    );
  });

  it("treats Windows, Linux and unknown as other", () => {
    expect(detectPlatform({ platform: "Win32" })).toBe("other");
    expect(detectPlatform({ platform: "Linux x86_64" })).toBe("other");
    expect(detectPlatform(undefined)).toBe("other");
  });
});

describe("formatShortcut", () => {
  it("maps mod to Ctrl off macOS and ⌘ on macOS", () => {
    expect(labels("mod+k", "other")).toEqual(["Ctrl", "K"]);
    expect(labels("mod+k", "mac")).toEqual(["⌘", "K"]);
  });

  it("formats modifiers and named keys per platform", () => {
    expect(labels("shift+enter", "other")).toEqual(["Shift", "Enter"]);
    expect(labels("shift+enter", "mac")).toEqual(["⇧", "↵"]);
    expect(labels("mod+alt+backspace", "mac")).toEqual(["⌘", "⌥", "⌫"]);
  });

  it("is case and whitespace tolerant and capitalises unknown keys", () => {
    expect(labels(" Mod + Shift + p ", "other")).toEqual(["Ctrl", "Shift", "P"]);
    expect(labels("f12", "other")).toEqual(["F12"]);
    expect(labels("esc", "mac")).toEqual(["Esc"]);
  });

  it("supports a literal plus and drops empty parts", () => {
    expect(labels("mod+plus", "other")).toEqual(["Ctrl", "+"]);
    expect(labels("", "other")).toEqual([]);
  });
});

describe("describeShortcut", () => {
  it("joins spoken names", () => {
    expect(describeShortcut("mod+shift+n", "mac")).toBe("Command+Shift+N");
    expect(describeShortcut("mod+shift+n", "other")).toBe("Ctrl+Shift+N");
  });
});
