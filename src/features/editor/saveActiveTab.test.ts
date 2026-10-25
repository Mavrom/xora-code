import { beforeEach, describe, expect, it, vi } from "vitest";
import { ipc } from "@/shared/lib/ipc";
import { saveActiveTab } from "./saveActiveTab";
import { isDirty, useEditorStore } from "./store";

vi.mock("@/shared/lib/ipc", () => ({ ipc: { writeFile: vi.fn() } }));

const writeFile = vi.mocked(ipc.writeFile);
const s = () => useEditorStore.getState();

beforeEach(() => {
  useEditorStore.setState({ tabs: [], activePath: null });
  writeFile.mockReset();
  writeFile.mockResolvedValue(undefined);
});

describe("saveActiveTab", () => {
  it("does nothing when no tab is active", async () => {
    await expect(saveActiveTab()).resolves.toEqual({ ok: true });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("skips the write when the active tab is clean", async () => {
    s().openFile("/a.ts", "x");
    await expect(saveActiveTab()).resolves.toEqual({ ok: true });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("writes a dirty tab and marks it saved", async () => {
    s().openFile("/a.ts", "x");
    s().updateContent("/a.ts", "xy");
    await expect(saveActiveTab()).resolves.toEqual({ ok: true });
    expect(writeFile).toHaveBeenCalledExactlyOnceWith("/a.ts", "xy");
    expect(isDirty(s().tabs[0])).toBe(false);
  });

  it("reports a failed write and keeps the tab dirty", async () => {
    writeFile.mockRejectedValue("permission denied");
    s().openFile("/a.ts", "x");
    s().updateContent("/a.ts", "xy");
    await expect(saveActiveTab()).resolves.toEqual({ ok: false, error: "permission denied" });
    expect(isDirty(s().tabs[0])).toBe(true);
  });
});
