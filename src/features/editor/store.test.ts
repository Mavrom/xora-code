import { beforeEach, describe, expect, it } from "vitest";
import { isDirty, useEditorStore } from "./store";

const s = () => useEditorStore.getState();

beforeEach(() => {
  useEditorStore.setState({ tabs: [], activePath: null, saveError: null });
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

describe("disk changes", () => {
  it("a clean tab reloads new disk content", () => {
    s().openFile("/a.ts", "old");
    s().applyDiskContent("/a.ts", "new");
    expect(s().tabs[0]).toMatchObject({ content: "new", savedContent: "new" });
    expect(s().tabs[0].diskChanged).toBeUndefined();
  });

  it("a dirty tab keeps its edits and is flagged", () => {
    s().openFile("/a.ts", "old");
    s().updateContent("/a.ts", "mine");
    s().applyDiskContent("/a.ts", "theirs");
    expect(s().tabs[0]).toMatchObject({ content: "mine", savedContent: "old", diskChanged: true });
    s().markSaved("/a.ts", "mine");
    expect(s().tabs[0].diskChanged).toBeUndefined();
  });

  it("disk content equal to the edits counts as saved", () => {
    s().openFile("/a.ts", "old");
    s().updateContent("/a.ts", "same");
    s().applyDiskContent("/a.ts", "same");
    expect(isDirty(s().tabs[0])).toBe(false);
    expect(s().tabs[0].diskChanged).toBeUndefined();
  });

  it("our own save echoing back is a no-op", () => {
    s().openFile("/a.ts", "x");
    const before = s().tabs;
    s().applyDiskContent("/a.ts", "x");
    expect(s().tabs).toBe(before);
  });

  it("a vanished file flags the tab once and a later matching read clears it", () => {
    s().openFile("/a.ts", "x");
    s().markDiskChanged("/a.ts");
    const flagged = s().tabs;
    s().markDiskChanged("/a.ts");
    expect(s().tabs).toBe(flagged);
    s().applyDiskContent("/a.ts", "x");
    expect(s().tabs[0].diskChanged).toBeUndefined();
  });

  it("closing a tab drops its save error only", () => {
    s().openFile("/a.ts", "");
    s().openFile("/b.ts", "");
    s().setSaveError({ path: "/a.ts", message: "denied" });
    s().closeTab("/b.ts");
    expect(s().saveError).not.toBeNull();
    s().closeTab("/a.ts");
    expect(s().saveError).toBeNull();
  });
});
