import { beforeEach, describe, expect, it } from "vitest";
import { isDiffTab, isDirty, useEditorStore } from "./store";
import { diffTabKey } from "./tabKind";

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

describe("diff tabs", () => {
  const key = diffTabKey("/a.ts");

  it("opens beside the file's own tab, read-only and clean", () => {
    s().openFile("/a.ts", "x");
    s().openDiff("/a.ts", "old", "new");
    expect(s().tabs.map((t) => t.path)).toEqual(["/a.ts", key]);
    expect(s().activePath).toBe(key);
    const tab = s().tabs[1];
    expect(isDiffTab(tab)).toBe(true);
    expect(isDiffTab(s().tabs[0])).toBe(false);
    expect(tab).toMatchObject({ name: "a.ts", diff: { oldText: "old", newText: "new" } });
    expect(isDirty(tab)).toBe(false);
  });

  it("opening it again updates the one tab and focuses it", () => {
    s().openDiff("/a.ts", null, "v1");
    s().openFile("/b.ts", "");
    s().openDiff("/a.ts", "v1", "v2");
    expect(s().tabs.filter((t) => t.path === key)).toHaveLength(1);
    expect(s().tabs[0].diff).toEqual({ oldText: "v1", newText: "v2" });
    expect(s().activePath).toBe(key);
  });

  it("ignores content, save and disk updates", () => {
    s().openDiff("/a.ts", "old", "new");
    const before = s().tabs;
    s().updateContent(key, "typed");
    s().markSaved(key, "typed");
    s().applyDiskContent(key, "disk");
    s().reloadContent(key, "disk");
    s().markDiskChanged(key);
    expect(s().tabs).toBe(before);
  });

  it("closes like any tab and leaves the file tab alone", () => {
    s().openFile("/a.ts", "x");
    s().openDiff("/a.ts", "old", "new");
    s().closeTab(key);
    expect(s().tabs.map((t) => t.path)).toEqual(["/a.ts"]);
    expect(s().activePath).toBe("/a.ts");
  });
});
