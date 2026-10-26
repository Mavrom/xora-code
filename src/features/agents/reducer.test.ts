import { describe, expect, it, vi } from "vitest";
import {
  createAgentData,
  createSessionView,
  reduceEvents,
  TERMINAL_OUTPUT_LIMIT,
  type AgentData,
  type SessionView,
} from "./reducer";
import type { AcpSessionUpdate, AgentEvent, SessionSetup } from "./types";

const SID = "s1";

const setup = (over: Partial<SessionSetup> = {}): SessionSetup => ({
  sessionId: SID,
  agentId: "claude",
  modes: null,
  configOptions: null,
  models: null,
  agentCapabilities: { loadSession: true },
  ...over,
});

function withSession(over: Partial<SessionSetup> = {}): AgentData {
  const data = createAgentData();
  const view = createSessionView(setup(over), "C:\\repo");
  return { ...data, sessions: { [view.sessionId]: view } };
}

const up = (update: AcpSessionUpdate, sessionId = SID): AgentEvent => ({
  type: "sessionUpdate",
  sessionId,
  update,
});
const text = (
  kind: "agent_message_chunk" | "agent_thought_chunk" | "user_message_chunk",
  t: string,
) => up({ sessionUpdate: kind, content: { type: "text", text: t } });

function run(events: AgentEvent[], data = withSession(), now = 1000): SessionView {
  return reduceEvents(data, events, now).sessions[SID];
}

describe("message chunks", () => {
  it("merges consecutive agent chunks into one message", () => {
    const v = run([text("agent_message_chunk", "Hel"), text("agent_message_chunk", "lo")]);
    expect(v.items).toEqual([{ kind: "agent", id: "agent-1", text: "Hello" }]);
  });

  it("starts a new agent message after a tool call", () => {
    const v = run([
      text("agent_message_chunk", "a"),
      up({ sessionUpdate: "tool_call", toolCallId: "t1", title: "Read" }),
      text("agent_message_chunk", "b"),
    ]);
    expect(v.items.map((i) => i.kind)).toEqual(["agent", "tool", "agent"]);
    expect(v.items[2]).toMatchObject({ kind: "agent", text: "b" });
  });

  it("merges replayed user chunks into one user message", () => {
    const v = run([text("user_message_chunk", "fix "), text("user_message_chunk", "it")]);
    expect(v.items).toEqual([
      { kind: "user", id: "user-1", blocks: [{ type: "text", text: "fix it" }] },
    ]);
  });

  it("renders resource links as markdown and ignores images in agent text", () => {
    const v = run([
      up({
        sessionUpdate: "agent_message_chunk",
        content: { type: "resource_link", uri: "file:///a.ts", name: "a.ts" },
      }),
      up({
        sessionUpdate: "agent_message_chunk",
        content: { type: "image", data: "xx", mimeType: "image/png" },
      }),
    ]);
    expect(v.items).toEqual([{ kind: "agent", id: "agent-1", text: "[a.ts](file:///a.ts)" }]);
  });

  it("does not mutate the previous state", () => {
    const data = withSession();
    const a = reduceEvents(data, [text("agent_message_chunk", "x")], 1);
    const b = reduceEvents(a, [text("agent_message_chunk", "y")], 2);
    expect(a.sessions[SID].items[0]).toMatchObject({ text: "x" });
    expect(b.sessions[SID].items[0]).toMatchObject({ text: "xy" });
    expect(data.sessions[SID].items).toEqual([]);
  });
});

describe("thoughts", () => {
  it("times a thought from first chunk until the next item", () => {
    const data = withSession();
    const a = reduceEvents(data, [text("agent_thought_chunk", "hmm")], 1000);
    const b = reduceEvents(a, [text("agent_thought_chunk", "...")], 2000);
    expect(b.sessions[SID].items[0]).toMatchObject({
      kind: "thought",
      text: "hmm...",
      startedAt: 1000,
      endedAt: null,
    });
    const c = reduceEvents(b, [text("agent_message_chunk", "ok")], 13000);
    expect(c.sessions[SID].items[0]).toMatchObject({ endedAt: 13000 });
  });

  it("closes an open thought when the turn ends", () => {
    const data = withSession();
    const a = reduceEvents(data, [text("agent_thought_chunk", "x")], 10);
    const b = reduceEvents(a, [{ type: "turnEnded", sessionId: SID, stopReason: "end_turn" }], 50);
    expect(b.sessions[SID].items[0]).toMatchObject({ endedAt: 50 });
  });
});

describe("tool calls", () => {
  it("merges updates by id and replaces content when given", () => {
    const v = run([
      up({
        sessionUpdate: "tool_call",
        toolCallId: "t1",
        title: "Edit a.ts",
        kind: "edit",
        status: "pending",
        content: [{ type: "content", content: { type: "text", text: "old" } }],
        locations: [{ path: "C:\\repo\\a.ts" }],
      }),
      up({ sessionUpdate: "tool_call_update", toolCallId: "t1", status: "in_progress" }),
      up({
        sessionUpdate: "tool_call_update",
        toolCallId: "t1",
        content: [{ type: "diff", path: "C:\\repo\\a.ts", oldText: "a", newText: "b" }],
      }),
    ]);
    expect(v.items).toHaveLength(1);
    const item = v.items[0];
    expect(item.kind).toBe("tool");
    if (item.kind !== "tool") return;
    expect(item.id).toBe("t1");
    expect(item.call).toEqual({
      toolCallId: "t1",
      title: "Edit a.ts",
      kind: "edit",
      status: "in_progress",
      content: [{ type: "diff", path: "C:\\repo\\a.ts", oldText: "a", newText: "b" }],
      locations: [{ path: "C:\\repo\\a.ts" }],
    });
    expect(item.call).not.toHaveProperty("sessionUpdate");
  });

  it("stamps start and end times", () => {
    const data = withSession();
    const a = reduceEvents(
      data,
      [up({ sessionUpdate: "tool_call", toolCallId: "t", title: "x" })],
      100,
    );
    const b = reduceEvents(
      a,
      [up({ sessionUpdate: "tool_call_update", toolCallId: "t", status: "failed" })],
      400,
    );
    expect(b.sessions[SID].items[0]).toMatchObject({ startedAt: 100, endedAt: 400 });
  });

  it("creates a tool item from an update with an unknown id", () => {
    const v = run([
      up({ sessionUpdate: "tool_call_update", toolCallId: "t9", status: "in_progress" }),
    ]);
    expect(v.items[0]).toMatchObject({
      kind: "tool",
      call: { toolCallId: "t9", title: "", status: "in_progress" },
    });
  });

  it("records completed diffs as review changes, keeping the first old text", () => {
    const v = run([
      up({
        sessionUpdate: "tool_call",
        toolCallId: "t1",
        title: "e",
        kind: "edit",
        status: "completed",
        content: [{ type: "diff", path: "/a", oldText: "1", newText: "2" }],
      }),
      up({
        sessionUpdate: "tool_call",
        toolCallId: "t2",
        title: "e",
        kind: "edit",
        status: "pending",
        content: [{ type: "diff", path: "/a", oldText: "2", newText: "3" }],
      }),
      up({ sessionUpdate: "tool_call_update", toolCallId: "t2", status: "completed" }),
      up({
        sessionUpdate: "tool_call_update",
        toolCallId: "t3",
        status: "completed",
        content: [{ type: "diff", path: "/new", oldText: null, newText: "n" }],
      }),
    ]);
    expect(v.changes).toEqual([
      { path: "/a", oldText: "1", newText: "3" },
      { path: "/new", oldText: null, newText: "n" },
    ]);
  });

  it("adds written files to changes once", () => {
    const v = run([
      { type: "fileWritten", sessionId: SID, path: "/b" },
      { type: "fileWritten", sessionId: SID, path: "/b" },
    ]);
    expect(v.changes).toEqual([{ path: "/b", oldText: undefined, newText: undefined }]);
  });
});

describe("plan, notices and session info", () => {
  it("keeps a single plan item updated in place", () => {
    const v = run([
      up({
        sessionUpdate: "plan",
        entries: [{ content: "a", priority: "high", status: "pending" }],
      }),
      text("agent_message_chunk", "x"),
      up({
        sessionUpdate: "plan",
        entries: [{ content: "a", priority: "high", status: "completed" }],
      }),
    ]);
    expect(v.items.map((i) => i.kind)).toEqual(["plan", "agent"]);
    expect(v.items[0]).toMatchObject({ entries: [{ status: "completed" }] });
  });

  it("stores commands, usage, title and notices", () => {
    const v = run([
      up({
        sessionUpdate: "available_commands_update",
        availableCommands: [{ name: "review", description: "r" }],
      }),
      up({ sessionUpdate: "usage_update", used: 10, size: 100 }),
      up({
        sessionUpdate: "session_info_update",
        title: "Özet",
        updatedAt: "2026-10-25T10:00:00Z",
      }),
      up({ sessionUpdate: "notice", severity: "warning", title: "Dikkat" }),
    ]);
    expect(v.commands).toEqual([{ name: "review", description: "r" }]);
    expect(v.usage).toEqual({ used: 10, size: 100 });
    expect(v.title).toBe("Özet");
    expect(v.updatedAt).toBe("2026-10-25T10:00:00Z");
    expect(v.items).toEqual([
      { kind: "notice", id: "notice-1", severity: "warning", title: "Dikkat" },
    ]);
  });

  it("keeps the title when an info update omits it", () => {
    const v = run([
      up({ sessionUpdate: "session_info_update", title: "A" }),
      up({ sessionUpdate: "session_info_update", updatedAt: "t" }),
    ]);
    expect(v.title).toBe("A");
  });

  it("ignores unknown update kinds", () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    const data = withSession();
    const out = reduceEvents(data, [up({ sessionUpdate: "subagent_spawned", foo: 1 })], 1);
    expect(out.sessions[SID].items).toEqual([]);
    expect(debug).toHaveBeenCalled();
    debug.mockRestore();
  });
});

describe("controls", () => {
  const cfg = (current: string) => ({
    id: "model",
    name: "Model",
    category: "model" as const,
    type: "select" as const,
    currentValue: current,
    options: [{ value: current, name: current }],
  });

  it("replaces the whole config list on config_option_update", () => {
    const data = withSession({
      configOptions: [cfg("a"), { ...cfg("e"), id: "effort", category: "thought_level" }],
    });
    expect(data.sessions[SID].controls.effort).toBeDefined();
    const v = run([up({ sessionUpdate: "config_option_update", configOptions: [cfg("b")] })], data);
    expect(v.controls.model?.current).toBe("b");
    expect(v.controls.effort).toBeUndefined();
  });

  it("follows current_mode_update for legacy modes", () => {
    const data = withSession({
      agentId: "gemini",
      modes: {
        currentModeId: "default",
        availableModes: [
          { id: "default", name: "Default" },
          { id: "yolo", name: "YOLO" },
        ],
      },
    });
    const v = run([up({ sessionUpdate: "current_mode_update", currentModeId: "yolo" })], data);
    expect(v.controls.mode?.current).toBe("yolo");
    expect(v.source.modes?.currentModeId).toBe("yolo");
  });
});

describe("turns", () => {
  it("ends a turn and records the stop reason", () => {
    const data = withSession();
    data.sessions[SID] = { ...data.sessions[SID], turn: "cancelling" };
    const v = run([{ type: "turnEnded", sessionId: SID, stopReason: "cancelled" }], data);
    expect(v.turn).toBe("idle");
    expect(v.lastStopReason).toBe("cancelled");
  });

  it("records a failed turn as an error notice", () => {
    const data = withSession();
    data.sessions[SID] = { ...data.sessions[SID], turn: "running" };
    const v = run([{ type: "turnFailed", sessionId: SID, message: "boom", code: -32603 }], data);
    expect(v.turn).toBe("idle");
    expect(v.error).toEqual({ message: "boom", code: -32603 });
    expect(v.items).toEqual([{ kind: "notice", id: "notice-1", severity: "error", title: "boom" }]);
  });

  it("keeps processing tool updates after a cancelled turn", () => {
    const v = run([
      up({ sessionUpdate: "tool_call", toolCallId: "t", title: "bg", status: "in_progress" }),
      { type: "turnEnded", sessionId: SID, stopReason: "cancelled" },
      up({ sessionUpdate: "tool_call_update", toolCallId: "t", status: "completed" }),
    ]);
    expect(v.items[0]).toMatchObject({ call: { status: "completed" } });
  });
});

describe("permissions", () => {
  const request: AgentEvent = {
    type: "permissionRequested",
    requestId: "r1",
    sessionId: SID,
    toolCall: { toolCallId: "t1", title: "Write a.ts", kind: "edit", status: "pending" },
    options: [{ optionId: "allow", name: "Allow", kind: "allow_once" }],
  };

  it("adds a pending permission and an inline tool item", () => {
    const v = run([request]);
    expect(v.permissions).toEqual([
      {
        requestId: "r1",
        sessionId: SID,
        toolCall: request.type === "permissionRequested" && request.toolCall,
        options: [{ optionId: "allow", name: "Allow", kind: "allow_once" }],
      },
    ]);
    expect(v.items[0]).toMatchObject({
      kind: "tool",
      call: { toolCallId: "t1", title: "Write a.ts" },
    });
  });

  it("merges into an existing tool item instead of duplicating it", () => {
    const v = run([up({ sessionUpdate: "tool_call", toolCallId: "t1", title: "Write" }), request]);
    expect(v.items).toHaveLength(1);
    expect(v.items[0]).toMatchObject({ call: { title: "Write a.ts", kind: "edit" } });
  });

  it("removes a permission when resolved", () => {
    const v = run([request, { type: "permissionResolved", requestId: "r1", optionId: "allow" }]);
    expect(v.permissions).toEqual([]);
  });
});

describe("terminals", () => {
  it("appends output and records exit", () => {
    const v = run([
      { type: "terminalOutput", sessionId: SID, terminalId: "term", chunk: "a\n" },
      { type: "terminalOutput", sessionId: SID, terminalId: "term", chunk: "b\n" },
      { type: "terminalExited", sessionId: SID, terminalId: "term", exitCode: 1, signal: null },
    ]);
    expect(v.terminals.term).toEqual({
      output: "a\nb\n",
      truncated: false,
      exitCode: 1,
      signal: null,
      exited: true,
    });
  });

  it("keeps only the tail of very long output", () => {
    const big = "x".repeat(TERMINAL_OUTPUT_LIMIT);
    const v = run([
      { type: "terminalOutput", sessionId: SID, terminalId: "t", chunk: big },
      { type: "terminalOutput", sessionId: SID, terminalId: "t", chunk: "END" },
    ]);
    expect(v.terminals.t.output.length).toBe(TERMINAL_OUTPUT_LIMIT);
    expect(v.terminals.t.output.endsWith("END")).toBe(true);
    expect(v.terminals.t.truncated).toBe(true);
  });
});

describe("agents and routing", () => {
  it("updates agent status", () => {
    const out = reduceEvents(
      createAgentData(),
      [{ type: "agentStatus", agentId: "codex", status: { state: "starting" } }],
      1,
    );
    expect(out.agents.codex.status).toEqual({ state: "starting" });
  });

  it("stops running turns of a crashed agent", () => {
    const data = withSession();
    data.sessions[SID] = { ...data.sessions[SID], turn: "running" };
    const out = reduceEvents(
      data,
      [
        {
          type: "agentStatus",
          agentId: "claude",
          status: { state: "crashed", code: 1, stderrTail: [] },
        },
      ],
      1,
    );
    expect(out.sessions[SID].turn).toBe("idle");
  });

  it("buffers events for unknown sessions until the session is attached", () => {
    const data = createAgentData();
    const out = reduceEvents(data, [text("agent_message_chunk", "early")], 1);
    expect(out.sessions).toEqual({});
    expect(out.orphans[SID]).toHaveLength(1);
  });

  it("returns the same object for an empty batch", () => {
    const data = withSession();
    expect(reduceEvents(data, [], 1)).toBe(data);
  });

  it("processes a 1000-chunk stream quickly", () => {
    const events = Array.from({ length: 1000 }, (_, i) => text("agent_message_chunk", `w${i} `));
    const t0 = performance.now();
    let data = withSession();
    for (let i = 0; i < events.length; i += 50)
      data = reduceEvents(data, events.slice(i, i + 50), i);
    const ms = performance.now() - t0;
    expect(data.sessions[SID].items).toHaveLength(1);
    expect(ms).toBeLessThan(100);
  });
});
