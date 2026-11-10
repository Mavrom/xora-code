import { describe, expect, it } from "vitest";
import {
  branchItems,
  branchVia,
  canBranch,
  FILES_NOT_REVERTED,
  filesChangedFrom,
  forkPoint,
  inheritedControls,
  planBranch,
  STARTED_FROM_SUMMARY,
} from "./branch";
import { deriveControls } from "./controls";
import { FIXTURE_SETUPS } from "./fixtures";
import { createSessionView, type ChatItem } from "./reducer";
import type { AcpToolCall } from "./types";

const user = (id: string, text = id): ChatItem => ({
  kind: "user",
  id,
  blocks: [{ type: "text", text }],
});
const agent = (id: string, messageId?: string): ChatItem => ({
  kind: "agent",
  id,
  text: id,
  ...(messageId ? { messageId } : {}),
});
const tool = (id: string, call: Partial<AcpToolCall> = {}): ChatItem => ({
  kind: "tool",
  id,
  call: { toolCallId: id, title: id, status: "completed", ...call },
  startedAt: 0,
  endedAt: 0,
});

// Turn 1: u1 -> a1 (msg_1) ... a2 (msg_2); turn 2: u2 -> edit; turn 3: u3.
const ITEMS: ChatItem[] = [
  user("u1"),
  agent("a1", "msg_1"),
  tool("t1", { kind: "read" }),
  agent("a2", "msg_2"),
  user("u2"),
  tool("t2", { kind: "edit" }),
  agent("a3"),
  user("u3"),
];

describe("forkPoint", () => {
  it("is the last agent message id of the turn before", () => {
    expect(forkPoint(ITEMS, 4)).toBe("msg_2");
  });

  it("never reaches into an earlier turn", () => {
    // Turn 2 has no id: forking at msg_2 would drop turn 2 entirely.
    expect(forkPoint(ITEMS, 7)).toBeNull();
    expect(forkPoint(ITEMS, 0)).toBeNull();
  });
});

describe("filesChangedFrom", () => {
  it("sees edits, deletes, moves and diffs after the message", () => {
    expect(filesChangedFrom(ITEMS, 4)).toBe(true);
    expect(filesChangedFrom(ITEMS, 7)).toBe(false);
    const diff = tool("d", {
      kind: "other",
      content: [{ type: "diff", path: "a.ts", oldText: "a", newText: "b" }],
    });
    expect(filesChangedFrom([user("u"), diff], 0)).toBe(true);
    expect(filesChangedFrom([user("u"), tool("m", { kind: "move" })], 0)).toBe(true);
  });

  it("ignores reads, commands and failed edits", () => {
    const items = [
      user("u"),
      tool("r", { kind: "read" }),
      tool("x", { kind: "execute" }),
      tool("e", { kind: "edit", status: "failed" }),
    ];
    expect(filesChangedFrom(items, 0)).toBe(false);
  });
});

describe("planBranch", () => {
  it("plans from a user message", () => {
    expect(planBranch(ITEMS, "u2")).toEqual({
      index: 4,
      blocks: [{ type: "text", text: "u2" }],
      first: false,
      forkAfter: "msg_2",
      filesChanged: true,
    });
    expect(planBranch(ITEMS, "u1")).toMatchObject({ index: 0, first: true, forkAfter: null });
  });

  it("is null for anything but a user message", () => {
    expect(planBranch(ITEMS, "a1")).toBeNull();
    expect(planBranch(ITEMS, "missing")).toBeNull();
  });
});

describe("branchVia", () => {
  const forks = { sessionCapabilities: { fork: {} } };
  it("forks only with a cut point and an agent that forks", () => {
    expect(branchVia(planBranch(ITEMS, "u2")!, forks)).toBe("fork");
    expect(branchVia(planBranch(ITEMS, "u2")!, { loadSession: true })).toBe("summary");
    expect(branchVia(planBranch(ITEMS, "u3")!, forks)).toBe("summary");
  });

  it("starts fresh from the first message", () => {
    expect(branchVia(planBranch(ITEMS, "u1")!, forks)).toBe("new");
  });
});

describe("branchItems", () => {
  const source = createSessionView(FIXTURE_SETUPS.claude, "C:\\p", { items: ITEMS, nextId: 9 });

  it("keeps the conversation before the message for a fork", () => {
    const { items, nextId } = branchItems(source, planBranch(ITEMS, "u2")!, "fork");
    expect(items.slice(0, 4)).toEqual(ITEMS.slice(0, 4));
    expect(items[4]).toEqual({
      kind: "notice",
      id: "notice-9",
      severity: "info",
      title: FILES_NOT_REVERTED(),
    });
    expect(nextId).toBe(10);
  });

  it("says when it started from a summary, and only mentions files that changed", () => {
    const { items } = branchItems(source, planBranch(ITEMS, "u3")!, "summary");
    expect(items.map((i) => (i.kind === "notice" ? i.title : i.kind))).toEqual([
      STARTED_FROM_SUMMARY(),
    ]);
    expect(branchItems(source, planBranch(ITEMS, "u1")!, "new").items).toHaveLength(1);
  });
});

describe("canBranch", () => {
  const view = createSessionView(FIXTURE_SETUPS.claude, "C:\\p", { items: ITEMS });
  it("is offered only while nothing runs", () => {
    expect(canBranch(view)).toBe(true);
    expect(canBranch({ ...view, turn: "running" })).toBe(false);
    expect(canBranch({ ...view, loading: true })).toBe(false);
  });
});

describe("inheritedControls", () => {
  const base = deriveControls(FIXTURE_SETUPS.claude);
  const withValues = (values: Record<string, string>) =>
    deriveControls({
      ...FIXTURE_SETUPS.claude,
      configOptions: FIXTURE_SETUPS.claude.configOptions!.map(
        (o) => (o.id in values ? { ...o, currentValue: values[o.id] } : o) as typeof o,
      ),
    });

  it("carries model, mode and effort the new session offers", () => {
    const from = withValues({ model: "opus", mode: "plan", effort: "high" });
    expect(inheritedControls(from, base)).toEqual([
      { key: "model", via: "config", value: "opus" },
      { key: "mode", via: "config", value: "plan" },
      { key: "effort", via: "config", value: "high" },
    ]);
    expect(inheritedControls(from, base, { skipModel: true }).map((c) => c.key)).toEqual([
      "mode",
      "effort",
    ]);
  });

  it("skips equal values and values the new session does not offer", () => {
    expect(inheritedControls(base, base)).toEqual([]);
    expect(inheritedControls(withValues({ model: "gone" }), base)).toEqual([]);
  });
});
