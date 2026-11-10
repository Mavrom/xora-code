import { describe, expect, it } from "vitest";
import { groupShortcuts, shortcutSources } from "./shortcuts";

const commands = [
  { id: "a", title: "Klasör aç", group: "Dosya" },
  { id: "b", title: "Kaydet", group: "Dosya", shortcut: "mod+s" },
  { id: "c", title: "Inbox'a geç", group: "Görünüm", shortcut: "ctrl+shift+n" },
];

describe("groupShortcuts", () => {
  it("groups in registry order and keeps unbound commands", () => {
    expect(groupShortcuts(commands)).toEqual([
      {
        group: "Dosya",
        items: [
          { id: "a", title: "Klasör aç", shortcut: null },
          { id: "b", title: "Kaydet", shortcut: "mod+s" },
        ],
      },
      { group: "Görünüm", items: [{ id: "c", title: "Inbox'a geç", shortcut: "ctrl+shift+n" }] },
    ]);
  });

  it("filters by title, group or key, case-insensitively in Turkish", () => {
    expect(groupShortcuts(commands, "KLASÖR")[0].items.map((i) => i.id)).toEqual(["a"]);
    expect(groupShortcuts(commands, "görünüm")[0].items.map((i) => i.id)).toEqual(["c"]);
    expect(groupShortcuts(commands, "mod+s")[0].items.map((i) => i.id)).toEqual(["b"]);
    expect(groupShortcuts(commands, "yok")).toEqual([]);
  });
});

describe("shortcutSources", () => {
  const registry = [
    { id: "workspace.openFolder", title: "Open folder", group: "File" },
    { id: "editor.save", title: "Save", group: "File" },
  ];

  it("puts the palette first, then the commands, then the other bindable actions", () => {
    const rows = shortcutSources(registry, {});
    expect(rows[0]).toMatchObject({ id: "palette.open", shortcut: "mod+k" });
    expect(rows[1]).toEqual({ ...registry[0], shortcut: undefined });
    expect(rows[2]).toEqual({ ...registry[1], shortcut: "mod+s" });
    expect(rows.map((r) => r.id)).toContain("view.zoomIn");
    expect(rows.filter((r) => r.id === "editor.save")).toHaveLength(1);
  });

  it("shows the effective binding", () => {
    const rows = shortcutSources(registry, { "editor.save": "mod+alt+s", "palette.open": null });
    expect(rows.find((r) => r.id === "editor.save")?.shortcut).toBe("mod+alt+s");
    expect(rows.find((r) => r.id === "palette.open")?.shortcut).toBeUndefined();
  });
});
