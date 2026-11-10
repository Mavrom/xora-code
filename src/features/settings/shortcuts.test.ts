import { describe, expect, it } from "vitest";
import { groupShortcuts, shortcutSources, type ShortcutSource } from "./shortcuts";

const rows: ShortcutSource[] = [
  { id: "a", title: "Klasör aç", group: "Dosya", shortcuts: [] },
  { id: "b", title: "Kaydet", group: "Dosya", shortcuts: ["mod+s"] },
  { id: "c", title: "Inbox'a geç", group: "Görünüm", shortcuts: ["ctrl+shift+n"] },
];

describe("groupShortcuts", () => {
  it("groups in order and keeps unbound rows", () => {
    expect(groupShortcuts(rows)).toEqual([
      { group: "Dosya", items: [rows[0], rows[1]] },
      { group: "Görünüm", items: [rows[2]] },
    ]);
  });

  it("filters by title, group or key, case-insensitively in Turkish", () => {
    expect(groupShortcuts(rows, "KLASÖR")[0].items.map((i) => i.id)).toEqual(["a"]);
    expect(groupShortcuts(rows, "görünüm")[0].items.map((i) => i.id)).toEqual(["c"]);
    expect(groupShortcuts(rows, "mod+s")[0].items.map((i) => i.id)).toEqual(["b"]);
    expect(groupShortcuts(rows, "yok")).toEqual([]);
  });

  it("finds a row by the label shown for its keys", () => {
    const label = (s: string) => s.replace("mod", "Ctrl");
    expect(groupShortcuts(rows, "ctrl+s", label)[0].items.map((i) => i.id)).toEqual(["b"]);
  });
});

describe("shortcutSources", () => {
  const registry = [
    { id: "workspace.openFolder", title: "Open folder", group: "File" },
    { id: "editor.save", title: "Save", group: "File" },
  ];

  it("puts the palette first, then the commands, then the other bindable actions", () => {
    const list = shortcutSources(registry, {});
    expect(list[0]).toMatchObject({ id: "palette.open", shortcuts: ["mod+k", "mod+shift+p"] });
    expect(list[1]).toEqual({ ...registry[0], shortcuts: [] });
    expect(list[2]).toEqual({
      ...registry[1],
      shortcuts: ["mod+s"],
      action: "editor.save",
      modified: false,
    });
    expect(list.map((r) => r.id)).toContain("view.zoomIn");
    expect(list.filter((r) => r.id === "editor.save")).toHaveLength(1);
  });

  it("shows the effective binding and marks changed rows", () => {
    const list = shortcutSources(registry, { "editor.save": "mod+alt+s", "palette.open": null });
    expect(list.find((r) => r.id === "editor.save")).toMatchObject({
      shortcuts: ["mod+alt+s"],
      modified: true,
    });
    expect(list.find((r) => r.id === "palette.open")).toMatchObject({
      shortcuts: [],
      modified: true,
    });
  });
});
