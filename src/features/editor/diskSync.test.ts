import { beforeEach, describe, expect, it, vi } from "vitest";
import { ipc } from "@/shared/lib/ipc";
import { syncTabFromDisk, tabsAffected } from "./diskSync";
import { useEditorStore } from "./store";

vi.mock("@/shared/lib/ipc", () => ({ ipc: { readFile: vi.fn() } }));
vi.mock("@/features/workspace/fsWatch", () => ({ onFsChange: vi.fn() }));

const readFile = vi.mocked(ipc.readFile);
const s = () => useEditorStore.getState();

beforeEach(() => {
  useEditorStore.setState({ tabs: [], activePath: null, saveError: null });
  readFile.mockReset();
});

describe("tabsAffected", () => {
  const tabs = ["C:\\p\\src\\a.ts", "C:\\p\\b.ts"];

  it("matches changed files across separator style and case", () => {
    expect(tabsAffected(tabs, { paths: ["c:/P/src/A.ts"], full: false })).toEqual([
      "C:\\p\\src\\a.ts",
    ]);
  });

  it("includes tabs inside a changed folder but not prefix look-alikes", () => {
    expect(tabsAffected(tabs, { paths: ["C:\\p\\src"], full: false })).toEqual([
      "C:\\p\\src\\a.ts",
    ]);
    expect(tabsAffected(tabs, { paths: ["C:\\p\\sr"], full: false })).toEqual([]);
  });

  it("takes every tab on a full refresh", () => {
    expect(tabsAffected(tabs, { paths: [], full: true })).toEqual(tabs);
  });
});

describe("syncTabFromDisk", () => {
  it("reloads a clean tab", async () => {
    s().openFile("/a.ts", "old");
    readFile.mockResolvedValue("new");
    await syncTabFromDisk("/a.ts");
    expect(s().tabs[0].content).toBe("new");
  });

  it("flags a tab whose file is gone, but not on other read errors", async () => {
    s().openFile("/a.ts", "x");
    readFile.mockRejectedValue("[permission_denied] locked");
    await syncTabFromDisk("/a.ts");
    expect(s().tabs[0].diskChanged).toBeUndefined();
    readFile.mockRejectedValue("[not_found] os error 2");
    await syncTabFromDisk("/a.ts");
    expect(s().tabs[0].diskChanged).toBe(true);
  });
});
