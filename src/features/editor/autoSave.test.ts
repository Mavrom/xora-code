import { describe, expect, it } from "vitest";
import { autoSavable } from "./autoSave";
import type { Tab } from "./store";
import { diffTabKey } from "./tabKind";

const tab = (path: string, extra: Partial<Tab> = {}) =>
  ({ path, name: path, content: "a", savedContent: "a", ...extra }) as Tab;

describe("autoSavable", () => {
  it("takes dirty tabs only", () => {
    const tabs = [tab("clean"), tab("dirty", { content: "b" })];
    expect(autoSavable(tabs).map((t) => t.path)).toEqual(["dirty"]);
  });

  it("never overwrites a file that changed on disk", () => {
    expect(autoSavable([tab("x", { content: "b", diskChanged: true })])).toEqual([]);
  });

  it("never saves a diff tab, even one that looks dirty", () => {
    const diff = tab(diffTabKey("x"), { content: "b", diff: { oldText: "a", newText: "b" } });
    expect(autoSavable([diff])).toEqual([]);
  });
});
