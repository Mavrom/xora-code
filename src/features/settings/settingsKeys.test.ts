import { describe, expect, it } from "vitest";
import { isSettingsShortcut, isSidebarShortcut } from "./settingsKeys";

const key = (k: string, mods: Partial<KeyboardEvent> = {}) => ({
  key: k,
  code: "",
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

describe("isSettingsShortcut", () => {
  it("matches Ctrl+, and Cmd+,", () => {
    expect(isSettingsShortcut(key(",", { ctrlKey: true }))).toBe(true);
    expect(isSettingsShortcut(key(",", { metaKey: true }))).toBe(true);
  });

  it("ignores other combinations", () => {
    expect(isSettingsShortcut(key(","))).toBe(false);
    expect(isSettingsShortcut(key(",", { ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(isSettingsShortcut(key(",", { ctrlKey: true, altKey: true }))).toBe(false);
    expect(isSettingsShortcut(key(".", { ctrlKey: true }))).toBe(false);
  });
});

describe("isSidebarShortcut", () => {
  it("matches Ctrl+Shift+E and Ctrl+Shift+N by physical key", () => {
    expect(isSidebarShortcut(key("E", { code: "KeyE", ctrlKey: true, shiftKey: true }))).toBe(true);
    expect(isSidebarShortcut(key("N", { code: "KeyN", ctrlKey: true, shiftKey: true }))).toBe(true);
    expect(isSidebarShortcut(key("e", { code: "KeyE", ctrlKey: true }))).toBe(false);
  });
});
