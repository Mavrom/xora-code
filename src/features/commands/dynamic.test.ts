import { describe, expect, it, vi } from "vitest";
import { buildDynamicCommands } from "./dynamic";

vi.mock("@/features/agents/store", () => ({ useAgentStore: { getState: () => ({}) } }));
vi.mock("@/features/workspace/openFolder", () => ({ openRecent: vi.fn() }));
vi.mock("@/features/workspace/store", () => ({ useWorkspaceStore: { getState: () => ({}) } }));
vi.mock("@/app/uiStore", () => ({ useUiStore: { getState: () => ({}) } }));

const session = (id: string, cwd: string, title: string | null) => ({
  agentId: "claude" as const,
  sessionId: id,
  cwd,
  title,
  updatedAt: null,
});

describe("buildDynamicCommands", () => {
  it("lists the open folder's conversations and other recent folders", () => {
    const openSession = vi.fn();
    const openFolder = vi.fn();
    const cmds = buildDynamicCommands(
      [session("a", "C:/p", "Özet"), session("b", "C:/other", "x"), session("c", "C:/p", null)],
      ["C:/p", "C:/q/site"],
      "C:/p",
      { openSession, openFolder },
    );
    expect(cmds.map((c) => [c.group, c.title])).toEqual([
      ["Sohbetler", "Özet"],
      ["Sohbetler", "Adsız sohbet"],
      ["Son klasörler", "site"],
    ]);
    cmds[0].run();
    expect(openSession).toHaveBeenCalledWith(expect.objectContaining({ sessionId: "a" }));
    cmds[2].run();
    expect(openFolder).toHaveBeenCalledWith("C:/q/site");
  });

  it("shows no conversations without an open folder", () => {
    const cmds = buildDynamicCommands([session("a", "C:/p", "x")], ["C:/p"], null, {
      openSession: vi.fn(),
      openFolder: vi.fn(),
    });
    expect(cmds.map((c) => c.group)).toEqual(["Son klasörler"]);
  });
});
