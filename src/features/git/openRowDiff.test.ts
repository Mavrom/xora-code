import { beforeEach, describe, expect, it, vi } from "vitest";

const readFile = vi.fn<(path: string) => Promise<string>>();
const show = vi.fn<(dir: string, path: string, rev: string) => Promise<string | null>>();
vi.mock("@/shared/lib/ipc", () => ({ ipc: { readFile: (p: string) => readFile(p) } }));
vi.mock("./ipc", () => ({
  gitIpc: { show: (dir: string, path: string, rev: string) => show(dir, path, rev) },
}));

const { openRowDiff } = await import("./openRowDiff");
const { useEditorStore } = await import("@/features/editor/store");
const { diffTabKey } = await import("@/features/editor/tabKind");

const s = () => useEditorStore.getState();

beforeEach(() => {
  readFile.mockReset();
  show.mockReset();
  useEditorStore.setState({ tabs: [], activePath: null, saveError: null, reveal: null });
});

describe("openRowDiff", () => {
  it("opens the index against the disk for an unstaged row", async () => {
    show.mockResolvedValue("old\n");
    readFile.mockResolvedValue("new\n");
    await openRowDiff("C:/repo", "C:/repo", {
      path: "src/a.ts",
      origPath: null,
      kind: "modified",
      staged: false,
    });
    expect(show).toHaveBeenCalledExactlyOnceWith("C:/repo", "src/a.ts", "index");
    expect(readFile).toHaveBeenCalledExactlyOnceWith("C:\\repo\\src\\a.ts");
    expect(s().activePath).toBe(diffTabKey("C:\\repo\\src\\a.ts"));
    expect(s().tabs[0].diff).toEqual({ oldText: "old\n", newText: "new\n" });
  });

  it("shows a file missing on the left as new, without reading it", async () => {
    readFile.mockResolvedValue("x\n");
    await openRowDiff("/r", "/r", {
      path: "n.ts",
      origPath: null,
      kind: "untracked",
      staged: false,
    });
    expect(show).not.toHaveBeenCalled();
    expect(s().tabs[0].diff).toEqual({ oldText: null, newText: "x\n" });
  });

  it("opens nothing when a side cannot be shown", async () => {
    show.mockRejectedValue("[binary] the file is binary");
    await expect(
      openRowDiff("/r", "/r", { path: "b.png", origPath: null, kind: "modified", staged: true }),
    ).rejects.toBe("[binary] the file is binary");
    expect(s().tabs).toEqual([]);
  });
});
