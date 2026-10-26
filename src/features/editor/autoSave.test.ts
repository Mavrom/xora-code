import { describe, expect, it } from "vitest";
import { autoSavable } from "./autoSave";
import type { Tab } from "./store";

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
});
