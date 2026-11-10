import { beforeEach, describe, expect, it, vi } from "vitest";

const readFile = vi.fn<(path: string) => Promise<string>>();
vi.mock("@/shared/lib/ipc", () => ({ ipc: { readFile: (path: string) => readFile(path) } }));

const { revealInEditor } = await import("./editorBridge");
const { useEditorStore } = await import("@/features/editor/store");

const s = () => useEditorStore.getState();
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  readFile.mockReset();
  useEditorStore.setState({ tabs: [], activePath: null, saveError: null, reveal: null });
});

describe("revealInEditor", () => {
  it("activates an open tab and asks for the range", () => {
    s().openFile("/a.ts", "x");
    s().openFile("/b.ts", "y");
    const range = { line: 3, column: 5, endLine: 3, endColumn: 9 };
    revealInEditor("/a.ts", range);
    expect(s().activePath).toBe("/a.ts");
    expect(s().reveal).toEqual({ path: "/a.ts", range });
    expect(readFile).not.toHaveBeenCalled();
  });

  it("turns a line number into a cursor at the start of that line", () => {
    s().openFile("/a.ts", "x");
    revealInEditor("/a.ts", 7);
    expect(s().reveal?.range).toEqual({ line: 7, column: 1, endLine: 7, endColumn: 1 });
  });

  it("reads and opens a closed file; a plain open clears an old request", async () => {
    readFile.mockResolvedValue("content");
    s().setReveal({ path: "/old.ts", range: { line: 1, column: 1, endLine: 1, endColumn: 1 } });
    revealInEditor("/c.ts");
    expect(s().reveal).toBeNull();
    await flush();
    expect(s().activePath).toBe("/c.ts");
  });

  it("drops the request when the file cannot be read", async () => {
    readFile.mockRejectedValue("[not_found] gone");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    revealInEditor("/gone.ts", 2);
    expect(s().reveal?.path).toBe("/gone.ts");
    await flush();
    expect(s().reveal).toBeNull();
  });
});
