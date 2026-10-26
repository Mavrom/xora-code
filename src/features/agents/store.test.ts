import { describe, expect, it, vi } from "vitest";
import { DEFAULT_AGENT_SETTINGS, type AgentSettings } from "./defaults";
import { FIXTURE_SETUPS, FIXTURE_STATUSES, createFixtureIpc, fixtureAgents } from "./fixtures";
import type { AgentIpc } from "./ipc";
import {
  createAgentStore,
  selectActiveSession,
  selectProjectGroups,
  selectSessionList,
} from "./store";
import type { AgentEvent, AgentId } from "./types";

function setup(
  opts: {
    ipc?: Partial<AgentIpc>;
    settings?: Partial<AgentSettings>;
    lastModel?: string | null;
  } = {},
) {
  const base = createFixtureIpc({ stepMs: 0 });
  const ipc: AgentIpc = { ...base, ...opts.ipc };
  for (const k of Object.keys(ipc) as (keyof AgentIpc)[]) {
    ipc[k] = vi.fn(ipc[k]) as never;
  }
  const schedule = vi.fn();
  const saved: [AgentId, string][] = [];
  const store = createAgentStore({
    ipc,
    schedule,
    now: () => 5_000,
    settings: () => ({ ...DEFAULT_AGENT_SETTINGS, ...opts.settings }),
    lastModel: { load: () => opts.lastModel ?? null, save: (a, m) => saved.push([a, m]) },
  });
  return { store, ipc, schedule, saved, s: () => store.getState() };
}

const ended = (
  sessionId: string,
  stopReason: "end_turn" | "cancelled" = "end_turn",
): AgentEvent => ({
  type: "turnEnded",
  sessionId,
  stopReason,
});

describe("event batching", () => {
  it("schedules one flush for a burst and applies all events in it", async () => {
    const { s, schedule } = setup();
    const id = await s().newSession("claude", "C:\\p");
    for (const t of ["a", "b", "c"]) {
      s().ingest({
        type: "sessionUpdate",
        sessionId: id,
        update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: t } },
      });
    }
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(s().sessions[id].items).toEqual([]);
    s().flush();
    expect(s().sessions[id].items).toEqual([{ kind: "agent", id: "agent-1", text: "abc" }]);
    s().ingest(ended(id));
    expect(schedule).toHaveBeenCalledTimes(2);
  });
});

describe("sessions", () => {
  it("opens a session, makes it active and applies settings defaults", async () => {
    const { s, ipc } = setup({ settings: { approvalPolicy: "autoEdits", defaultEffort: "high" } });
    const id = await s().newSession("claude", "C:\\p");
    expect(s().activeSessionId).toBe(id);
    expect(selectActiveSession(s())?.agentId).toBe("claude");
    expect(vi.mocked(ipc.setConfigOption).mock.calls.map((c) => [c[1], c[2]])).toEqual([
      ["mode", "acceptEdits"],
      ["effort", "high"],
    ]);
  });

  it("restores the last model first and re-plans on its options", async () => {
    const opus = structuredClone(FIXTURE_SETUPS.claude.configOptions!);
    const { s, ipc } = setup({
      lastModel: "opus",
      settings: { defaultEffort: "low" },
      ipc: {
        // Opus drops the effort option entirely.
        setConfigOption: async (_sid, configId, value) =>
          configId === "model"
            ? opus
                .filter((o) => o.id !== "effort")
                .map(
                  (o) => (o.id === "model" ? { ...o, currentValue: String(value) } : o) as typeof o,
                )
            : opus,
      },
    });
    const id = await s().newSession("claude", "C:\\p");
    expect(vi.mocked(ipc.setConfigOption).mock.calls.map((c) => c[1])).toEqual(["model"]);
    expect(s().sessions[id].controls.model?.current).toBe("opus");
    expect(s().sessions[id].controls.effort).toBeUndefined();
  });

  it("uses legacy RPCs for Gemini", async () => {
    const { s, ipc } = setup({ settings: { approvalPolicy: "full" } });
    const id = await s().newSession("gemini", "C:\\p");
    expect(ipc.setMode).toHaveBeenCalledWith(id, "yolo");
    await s().setControl(id, "legacy-model", "gemini-3-pro");
    expect(ipc.setModel).toHaveBeenCalledWith(id, "gemini-3-pro");
    expect(s().sessions[id].controls.model?.current).toBe("gemini-3-pro");
  });

  it("remembers a model the user picks and rolls back a failed change", async () => {
    let fail = false;
    const { s, saved } = setup({
      ipc: {
        setConfigOption: async (_sid, configId, value) => {
          if (fail) throw new Error("nope");
          return FIXTURE_SETUPS.claude.configOptions!.map(
            (o) => (o.id === configId ? { ...o, currentValue: value } : o) as typeof o,
          );
        },
      },
    });
    const id = await s().newSession("claude", "C:\\p");
    await s().setControl(id, "model", "haiku");
    expect(saved).toEqual([["claude", "haiku"]]);
    fail = true;
    await expect(s().setControl(id, "mode", "plan")).rejects.toThrow("nope");
    expect(s().sessions[id].controls.mode?.current).toBe("default");
  });

  it("propagates new-session errors (e.g. sign-in required)", async () => {
    const { s } = setup({
      ipc: {
        sessionNew: async () => {
          throw "auth_required: sign in";
        },
      },
    });
    await expect(s().newSession("codex", "C:\\p")).rejects.toBe("auth_required: sign in");
    expect(s().activeSessionId).toBeNull();
  });

  it("loads a past session with its replay and stops loading", async () => {
    const { s, ipc } = setup();
    await s().init();
    await s().loadSession("claude", "h1", "C:\\p");
    const v = s().sessions.h1;
    expect(v.loading).toBe(false);
    expect(v.items[0]).toMatchObject({ kind: "user" });
    expect(v.items.some((i) => i.kind === "agent")).toBe(true);
    expect(v.controls.model).toBeDefined();
    expect(s().activeSessionId).toBe("h1");
    // Already open: only activates.
    s().setActiveSession(null);
    await s().loadSession("claude", "h1", "C:\\p");
    expect(ipc.sessionLoad).toHaveBeenCalledTimes(1);
    expect(s().activeSessionId).toBe("h1");
  });

  it("closes a session and clears the active one", async () => {
    const { s, ipc } = setup();
    const id = await s().newSession("claude", "C:\\p");
    await s().closeSession(id);
    expect(s().sessions[id]).toBeUndefined();
    expect(s().activeSessionId).toBeNull();
    expect(ipc.sessionClose).toHaveBeenCalledWith(id);
  });
});

describe("turns", () => {
  it("adds the user message and queues prompts while a turn runs", async () => {
    const { s, ipc } = setup({ ipc: { prompt: async () => {} } });
    const id = await s().newSession("claude", "C:\\p");
    await s().prompt(id, "first");
    expect(s().sessions[id].turn).toBe("running");
    expect(s().sessions[id].items[0]).toEqual({
      kind: "user",
      id: "user-1",
      blocks: [{ type: "text", text: "first" }],
    });
    await s().prompt(id, "second");
    expect(s().sessions[id].queued).toEqual([[{ type: "text", text: "second" }]]);
    expect(ipc.prompt).toHaveBeenCalledTimes(1);

    s().ingest(ended(id));
    s().flush();
    expect(ipc.prompt).toHaveBeenCalledTimes(2);
    expect(s().sessions[id].queued).toEqual([]);
    expect(s().sessions[id].turn).toBe("running");
  });

  it("cancel clears the queue and does not auto-send", async () => {
    const { s, ipc } = setup({ ipc: { prompt: async () => {} } });
    const id = await s().newSession("claude", "C:\\p");
    await s().prompt(id, "a");
    await s().prompt(id, "b");
    await s().cancel(id);
    expect(s().sessions[id]).toMatchObject({ turn: "cancelling", queued: [] });
    expect(ipc.cancel).toHaveBeenCalledWith(id);
    s().ingest(ended(id, "cancelled"));
    s().flush();
    expect(s().sessions[id].turn).toBe("idle");
    expect(ipc.prompt).toHaveBeenCalledTimes(1);
  });

  it("records a failed prompt call", async () => {
    const { s } = setup({
      ipc: {
        prompt: async () => {
          throw new Error("agent gone");
        },
      },
    });
    const id = await s().newSession("claude", "C:\\p");
    await s().prompt(id, "x");
    expect(s().sessions[id]).toMatchObject({ turn: "idle", error: { message: "agent gone" } });
    const items = s().sessions[id].items;
    expect(items[items.length - 1]).toMatchObject({ kind: "notice", severity: "error" });
  });
});

describe("permissions", () => {
  it("removes the prompt at once and restores it if the response fails", async () => {
    let fail = false;
    const { s, ipc } = setup({
      ipc: {
        permissionRespond: async () => {
          if (fail) throw new Error("x");
        },
      },
    });
    const id = await s().newSession("claude", "C:\\p");
    const request: AgentEvent = {
      type: "permissionRequested",
      requestId: "r1",
      sessionId: id,
      toolCall: { toolCallId: "t1", title: "Write" },
      options: [{ optionId: "allow", name: "Allow", kind: "allow_once" }],
    };
    s().ingest(request);
    s().flush();
    fail = true;
    await expect(s().respondPermission("r1", "allow")).rejects.toThrow();
    expect(s().sessions[id].permissions).toHaveLength(1);
    fail = false;
    await s().respondPermission("r1", "allow");
    expect(s().sessions[id].permissions).toEqual([]);
    expect(ipc.permissionRespond).toHaveBeenLastCalledWith("r1", "allow");
  });
});

describe("agents", () => {
  it("loads the agent list on init and subscribes once", async () => {
    const { s, ipc } = setup();
    await Promise.all([s().init(), s().init()]);
    expect(ipc.subscribe).toHaveBeenCalledTimes(1);
    expect(s().agents.codex.version).toBe("2.2.2");
  });

  it("picks the auth RPC by method type", async () => {
    const { s, ipc } = setup({
      ipc: { list: async () => Object.values(fixtureAgents({ claude: "authRequired" })) },
    });
    await s().refreshAgents();
    await s().authenticate("claude", "claude-ai-login");
    expect(ipc.authTerminal).toHaveBeenCalledWith("claude", "claude-ai-login");
    await s().authenticate("codex", "chat-gpt");
    expect(ipc.authenticate).toHaveBeenCalledWith("codex", "chat-gpt");
  });

  it("restarts with resume when supported, else reloads from scratch", async () => {
    const { s, ipc } = setup();
    const c = await s().newSession("claude", "C:\\p");
    const g = await s().newSession("gemini", "C:\\p");
    s().ingest({ type: "agentStatus", agentId: "claude", status: FIXTURE_STATUSES.crashed });
    s().flush();
    await s().restart("claude");
    expect(ipc.sessionResume).toHaveBeenCalledWith("claude", c, "C:\\p");
    await s().restart("gemini");
    expect(ipc.sessionLoad).toHaveBeenCalledWith("gemini", g, "C:\\p");
    expect(s().sessions[g].loading).toBe(false);
  });
});

describe("history and session list", () => {
  it("lists only ready or selected agents and keeps other projects", async () => {
    const { s, ipc } = setup({
      ipc: {
        list: async () =>
          Object.values(fixtureAgents({ claude: "ready", codex: "authRequired", gemini: "ready" })),
        sessionsList: async (agentId, cwd) => {
          if (agentId === "gemini") throw new Error("index unreadable");
          return [{ agentId, sessionId: `${agentId}-${cwd}`, cwd, title: "t", updatedAt: null }];
        },
      },
    });
    await s().refreshAgents();
    await s().refreshHistory("C:\\a");
    await s().refreshHistory("C:\\b");
    expect(vi.mocked(ipc.sessionsList).mock.calls.map((c) => c[0])).toEqual([
      "claude",
      "gemini",
      "claude",
      "gemini",
    ]);
    expect(s().history.map((h) => h.cwd)).toEqual(["C:\\a", "C:\\b"]);
    expect(s().historyError).toContain("Gemini");
    expect(s().historyLoading).toBe(false);
    await s().refreshHistory("c:/a");
    expect(s().history).toHaveLength(2);
  });

  it("archives and unarchives, leaving the archived chat when it was open", async () => {
    const { s, ipc } = setup();
    const id = await s().newSession("claude", "C:\\p");
    const entry = { agentId: "claude" as const, sessionId: id, cwd: "C:\\p" };
    await s().archiveSession(entry, true);
    expect(ipc.sessionArchive).toHaveBeenCalledWith("claude", id, "C:\\p", true);
    expect(s().activeSessionId).toBeNull();
    expect(selectSessionList(s()).find((e) => e.sessionId === id)?.archived).toBe(true);
    await s().archiveSession(entry, false);
    expect(s().history.filter((h) => h.sessionId === id)).toHaveLength(1);
    expect(selectSessionList(s()).find((e) => e.sessionId === id)?.archived).toBe(false);
  });

  it("deletes a chat from history and the open sessions", async () => {
    const { s, ipc } = setup();
    const id = await s().newSession("claude", "C:\\p");
    await s().deleteSession({ agentId: "claude", sessionId: id, cwd: "C:\\p" });
    expect(ipc.sessionDelete).toHaveBeenCalledWith("claude", id, "C:\\p");
    expect(s().sessions[id]).toBeUndefined();
    expect(s().activeSessionId).toBeNull();
    expect(selectSessionList(s()).some((e) => e.sessionId === id)).toBe(false);
  });

  it("memoises list selectors", async () => {
    const { s } = setup();
    await s().newSession("claude", "C:\\p");
    const a = selectSessionList(s());
    expect(selectSessionList(s())).toBe(a);
    expect(selectProjectGroups(s())).toBe(selectProjectGroups(s()));
    expect(selectProjectGroups(s())[0].sessions[0]).toMatchObject({ open: true, active: true });
  });
});

describe("review", () => {
  it("accepts all changes or reverts one", async () => {
    const { s } = setup();
    const id = await s().newSession("claude", "C:\\p");
    s().ingest({ type: "fileWritten", sessionId: id, path: "/a" });
    s().ingest({ type: "fileWritten", sessionId: id, path: "/b" });
    s().flush();
    expect(await s().revertChange(id, "/a")).toBe("reverted");
    expect(s().sessions[id].changes.map((c) => c.path)).toEqual(["/b"]);
    s().acceptChanges(id);
    expect(s().sessions[id].changes).toEqual([]);
  });
});
