import { describe, expect, it } from "vitest";
import { groupShortcuts } from "./shortcuts";

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
