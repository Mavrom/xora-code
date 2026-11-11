import { describe, expect, it } from "vitest";
import type { SessionListEntry } from "@/features/agents/sessionList";
import { sameRowProps } from "./sessionRowProps";

const entry = (extra: Partial<SessionListEntry> = {}): SessionListEntry => ({
  agentId: "claude",
  sessionId: "s1",
  cwd: "C:/a",
  title: "t",
  updatedAt: "2026-01-01T00:00:00Z",
  open: false,
  active: false,
  running: false,
  archived: false,
  pinned: false,
  renamed: false,
  ...extra,
});

describe("sameRowProps", () => {
  const worktrees: never[] = [];

  it("treats a rebuilt but equal entry as the same row", () => {
    expect(sameRowProps({ entry: entry(), worktrees }, { entry: entry(), worktrees })).toBe(true);
  });

  it("re-renders when any field or the worktree list changes", () => {
    const base = { entry: entry(), worktrees };
    for (const extra of [
      { title: "u" },
      { active: true },
      { pinned: true },
      { updatedAt: null },
      { running: true },
    ] satisfies Partial<SessionListEntry>[]) {
      expect(sameRowProps(base, { entry: entry(extra), worktrees })).toBe(false);
    }
    expect(sameRowProps(base, { entry: entry(), worktrees: [] })).toBe(false);
  });
});
