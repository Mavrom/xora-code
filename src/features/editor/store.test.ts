import { beforeEach, describe, expect, it } from "vitest";
import { isDirty, useEditorStore } from "./store";

const s = () => useEditorStore.getState();

beforeEach(() => {
  useEditorStore.setState({ tabs: [], activePath: null });
});

describe("editor store", () => {
  it("opens a file as a new active tab", () => {
    s().openFile("C:\\p\\a.ts", "x");
    expect(s().tabs).toEqual([
      { path: "C:\\p\\a.ts", name: "a.ts", content: "x", savedContent: "x" },
    ]);
    expect(s().activePath).toBe("C:\\p\\a.ts");
  });

  it("re-opening an existing file only activates it and keeps edits", () => {
    s().openFile("/a.ts", "x");
    s().updateContent("/a.ts", "edited");
    s().openFile("/b.ts", "y");
    s().openFile("/a.ts", "from disk");
    expect(s().tabs).toHaveLength(2);
    expect(s().tabs[0].content).toBe("edited");
    expect(s().activePath).toBe("/a.ts");
  });

  it("tracks dirty state and clears it on save", () => {
    s().openFile("/a.ts", "x");
    s().updateContent("/a.ts", "xy");
    expect(isDirty(s().tabs[0])).toBe(true);
    s().markSaved("/a.ts", "xy");
    expect(isDirty(s().tabs[0])).toBe(false);
  });

  it("closing the active tab activates the previous neighbour", () => {
    s().openFile("/a.ts", "");
    s().openFile("/b.ts", "");
    s().openFile("/c.ts", "");
    s().closeTab("/c.ts");
    expect(s().activePath).toBe("/b.ts");
    s().setActive("/a.ts");
    s().closeTab("/a.ts");
    expect(s().activePath).toBe("/b.ts");
    s().closeTab("/b.ts");
    expect(s().activePath).toBeNull();
  });

  it("closing an inactive tab keeps the active one", () => {
    s().openFile("/a.ts", "");
    s().openFile("/b.ts", "");
    s().closeTab("/a.ts");
    expect(s().activePath).toBe("/b.ts");
  });

  it("closing an unknown path is a no-op", () => {
    s().openFile("/a.ts", "");
    s().closeTab("/zzz.ts");
    expect(s().tabs).toHaveLength(1);
  });
});
