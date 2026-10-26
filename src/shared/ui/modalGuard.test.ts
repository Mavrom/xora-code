import { describe, expect, it } from "vitest";
import { blocksWhileModal, enterModal, isModalOpen } from "./modalGuard";

const key = (k: string, mods: Partial<Record<"ctrlKey" | "metaKey" | "altKey", boolean>> = {}) => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...mods,
});

describe("blocksWhileModal", () => {
  it("lets plain keys through to the dialog", () => {
    for (const k of ["Tab", "Enter", "Escape", "a"])
      expect(blocksWhileModal(key(k), false)).toBe(false);
  });

  it("swallows app shortcuts", () => {
    expect(blocksWhileModal(key("w", { ctrlKey: true }), false)).toBe(true);
    expect(blocksWhileModal(key("k", { metaKey: true }), false)).toBe(true);
    expect(blocksWhileModal(key("E", { ctrlKey: true }), false)).toBe(true);
  });

  it("keeps clipboard keys working inside text fields only", () => {
    expect(blocksWhileModal(key("v", { ctrlKey: true }), true)).toBe(false);
    expect(blocksWhileModal(key("v", { ctrlKey: true }), false)).toBe(true);
    expect(blocksWhileModal(key("v", { altKey: true }), true)).toBe(true);
  });
});

describe("enterModal", () => {
  it("counts nested modals and leaving twice is harmless", () => {
    const a = enterModal();
    const b = enterModal();
    a();
    a();
    expect(isModalOpen()).toBe(true);
    b();
    expect(isModalOpen()).toBe(false);
  });
});
