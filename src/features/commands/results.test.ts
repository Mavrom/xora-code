import { describe, expect, it } from "vitest";
import { flatten, moveIndex, rankCommands } from "./results";

const cmd = (id: string, title: string, group: string, when?: () => boolean) => ({
  id,
  title,
  group,
  when,
});

const COMMANDS = [
  cmd("open", "Klasör aç", "Dosya"),
  cmd("save", "Aktif dosyayı kaydet", "Dosya"),
  cmd("editor", "Editörü göster/gizle", "Görünüm"),
  cmd("inbox", "Inbox'a geç", "Görünüm"),
  cmd("note", "Yeni not", "Inbox"),
];

const ids = (query: string, list = COMMANDS) =>
  flatten(rankCommands(list, query)).map((r) => r.item.id);

describe("rankCommands", () => {
  it("lists everything in registry order, grouped, for an empty query", () => {
    const groups = rankCommands(COMMANDS, "");
    expect(groups.map((g) => g.group)).toEqual(["Dosya", "Görünüm", "Inbox"]);
    expect(ids("")).toEqual(["open", "save", "editor", "inbox", "note"]);
  });

  it("hides commands whose `when` is false", () => {
    const list = [...COMMANDS, cmd("close", "Aktif sekmeyi kapat", "Dosya", () => false)];
    expect(ids("", list)).not.toContain("close");
    expect(ids("kapat", list)).toEqual([]);
  });

  it("drops non-matching commands", () => {
    expect(ids("yeni")).toEqual(["note"]);
    expect(ids("zzz")).toEqual([]);
  });

  it("orders groups by their best match and items by score", () => {
    const groups = rankCommands(COMMANDS, "not");
    expect(groups[0].group).toBe("Inbox");
    expect(groups[0].items[0].item.id).toBe("note");
  });

  it("keeps registry order for equal scores", () => {
    const list = [cmd("a", "Aynı", "G"), cmd("b", "Aynı", "G")];
    expect(ids("ay", list)).toEqual(["a", "b"]);
  });

  it("carries match positions for highlighting", () => {
    const [first] = flatten(rankCommands(COMMANDS, "aç"));
    expect(first.item.id).toBe("open");
    expect(first.positions).toEqual([7, 8]);
  });
});

describe("moveIndex", () => {
  it("wraps around both ends", () => {
    expect(moveIndex(0, 1, 3)).toBe(1);
    expect(moveIndex(2, 1, 3)).toBe(0);
    expect(moveIndex(0, -1, 3)).toBe(2);
  });

  it("stays at 0 for an empty list", () => {
    expect(moveIndex(0, 1, 0)).toBe(0);
    expect(moveIndex(0, -1, 0)).toBe(0);
  });
});
