// Agent state (design 4.1): agents, sessions, permissions, history. Channel
// events are queued and applied once per animation frame, so a burst of
// chunks becomes a single render.

import { create } from "zustand";
import { applyControlValue, findControl, type Control } from "./controls";
import {
  getAgentSettings,
  loadLastModel,
  planDefaults,
  saveLastModel,
  type AgentSettings,
  type ControlChange,
} from "./defaults";
import { errorMessage, tauriAgentIpc, type AgentIpc } from "./ipc";
import {
  AGENT_IDS,
  attachSession,
  beginTurn,
  createAgentData,
  createSessionView,
  reduceEvents,
  withSource,
  type AgentData,
  type SessionView,
} from "./reducer";
import {
  groupByProject,
  mergeSessionList,
  sameProject,
  type ProjectGroup,
  type SessionListEntry,
} from "./sessionList";
import type {
  AcpAuthMethod,
  AcpContentBlock,
  AgentEvent,
  AgentId,
  AgentSessionInfo,
} from "./types";

export interface AgentStoreDeps {
  /** Read on every call, so it can be swapped (fixture mode). */
  ipc: AgentIpc;
  /** Runs `flush` soon; defaults to the next animation frame. */
  schedule: (flush: () => void) => void;
  now: () => number;
  settings: () => AgentSettings;
  lastModel: {
    load: (agentId: AgentId) => string | null;
    save: (agentId: AgentId, model: string) => void;
  };
}

export interface AgentStoreState extends AgentData {
  /** Agent for the next new session. */
  selectedAgent: AgentId;
  activeSessionId: string | null;
  /** Agent history (`agent_sessions_list`), merged across agents and projects. */
  history: AgentSessionInfo[];
  historyLoading: boolean;
  historyError: string | null;

  /** Subscribes to events and loads the agent list. Idempotent. */
  init: () => Promise<void>;
  /** Queues an event; applied on the next frame. */
  ingest: (event: AgentEvent) => void;
  /** Applies queued events now. */
  flush: () => void;
  refreshAgents: () => Promise<void>;
  /** Reloads history for `cwd` from every agent that is ready or selected. */
  refreshHistory: (cwd: string) => Promise<void>;
  listSessions: (agentId: AgentId, cwd: string) => Promise<AgentSessionInfo[]>;

  selectAgent: (agentId: AgentId) => void;
  /** `null` shows the empty welcome (a fresh chat) without any agent call. */
  setActiveSession: (sessionId: string | null) => void;
  /** Opens a session, applies the settings defaults and makes it active. */
  newSession: (agentId: AgentId, cwd: string) => Promise<string>;
  /** Opens a past session (replay) or activates it when already open. */
  loadSession: (agentId: AgentId, sessionId: string, cwd: string) => Promise<void>;
  closeSession: (sessionId: string) => Promise<void>;
  /** Moves a conversation into or out of the archive. */
  archiveSession: (
    entry: Pick<AgentSessionInfo, "agentId" | "sessionId" | "cwd">,
    archived: boolean,
  ) => Promise<void>;
  /** Keeps a conversation at the top of the list, or lets it go back. */
  pinSession: (
    entry: Pick<AgentSessionInfo, "agentId" | "sessionId" | "cwd">,
    pinned: boolean,
  ) => Promise<void>;
  /** Names a conversation; null (or blank) gives the agent's title back. */
  renameSession: (
    entry: Pick<AgentSessionInfo, "agentId" | "sessionId" | "cwd">,
    title: string | null,
  ) => Promise<void>;
  /** Deletes a conversation for good (closing it first when open). */
  deleteSession: (entry: Pick<AgentSessionInfo, "agentId" | "sessionId" | "cwd">) => Promise<void>;

  /** Sends a prompt, or queues it while a turn is running. */
  prompt: (sessionId: string, input: string | AcpContentBlock[]) => Promise<void>;
  dropQueued: (sessionId: string, index: number) => void;
  /** Stops the turn; clears the queue and pending permissions. */
  cancel: (sessionId: string) => Promise<void>;
  setControl: (sessionId: string, key: string, value: string | boolean) => Promise<void>;
  respondPermission: (requestId: string, optionId: string | null) => Promise<void>;

  install: (agentId: AgentId) => Promise<void>;
  authenticate: (agentId: AgentId, methodId: string) => Promise<void>;
  /** Brings a crashed agent's open sessions back (resume, or load with replay). */
  restart: (agentId: AgentId) => Promise<void>;

  acceptChanges: (sessionId: string) => void;
  revertChange: (sessionId: string, path: string) => Promise<"reverted" | "conflict">;
  shutdown: () => Promise<void>;
}

/** Next animation frame, with a timer fallback because rAF pauses while the window is hidden. */
export function frameScheduler(flush: () => void) {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    flush();
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
  setTimeout(run, 50);
}

const textBlocks = (input: string | AcpContentBlock[]): AcpContentBlock[] =>
  typeof input === "string" ? [{ type: "text", text: input }] : input;

export function createAgentStore(partial: Partial<AgentStoreDeps> & { ipc: AgentIpc }) {
  const deps: AgentStoreDeps = {
    schedule: frameScheduler,
    now: Date.now,
    settings: getAgentSettings,
    lastModel: { load: loadLastModel, save: saveLastModel },
    ...partial,
  };

  let queue: AgentEvent[] = [];
  let scheduled = false;
  let initPromise: Promise<void> | null = null;

  return create<AgentStoreState>()((set, get) => {
    const data = (): AgentData => {
      const s = get();
      return { agents: s.agents, sessions: s.sessions, orphans: s.orphans };
    };

    /** Applies `fn` to one session, if it exists. */
    const patch = (sessionId: string, fn: (v: SessionView) => SessionView) => {
      const v = get().sessions[sessionId];
      if (!v) return;
      set({ sessions: { ...get().sessions, [sessionId]: fn(v) } });
    };

    const notice = (v: SessionView, title: string): SessionView => ({
      ...v,
      items: [...v.items, { kind: "notice", id: `notice-${v.nextId}`, severity: "error", title }],
      nextId: v.nextId + 1,
    });

    async function send(sessionId: string, blocks: AcpContentBlock[]) {
      patch(sessionId, (v) => beginTurn(v, blocks, deps.now()));
      try {
        await deps.ipc.prompt(sessionId, blocks);
      } catch (err) {
        const message = errorMessage(err);
        patch(sessionId, (v) =>
          notice({ ...v, turn: "idle", error: { message, code: null } }, message),
        );
      }
    }

    /** Sends `change`; optimistic, rolled back on failure. */
    async function applyChange(sessionId: string, change: ControlChange, remember: boolean) {
      const before = get().sessions[sessionId];
      if (!before) return;
      const prevSource = before.source;
      patch(sessionId, (v) =>
        withSource(v, applyControlValue(v.source, change.key, change.via, change.value)),
      );
      try {
        if (change.via === "config") {
          const list = await deps.ipc.setConfigOption(sessionId, change.key, change.value);
          patch(sessionId, (v) => withSource(v, { ...v.source, configOptions: list }));
        } else if (change.via === "mode") {
          await deps.ipc.setMode(sessionId, String(change.value));
        } else {
          await deps.ipc.setModel(sessionId, String(change.value));
        }
      } catch (err) {
        patch(sessionId, (v) => withSource(v, prevSource));
        throw err;
      }
      if (
        remember &&
        before.controls.model?.key === change.key &&
        typeof change.value === "string"
      ) {
        deps.lastModel.save(before.agentId, change.value);
      }
    }

    async function applyDefaults(sessionId: string) {
      const view = get().sessions[sessionId];
      if (!view) return;
      const settings = deps.settings();
      const lastModel = deps.lastModel.load(view.agentId);
      let plan = planDefaults(view.agentId, view.controls, settings, { lastModel });
      const modelKey = view.controls.model?.key;
      const modelChange = plan.find((c) => c.key === modelKey);
      if (modelChange) {
        await applyChange(sessionId, modelChange, false).catch((e) =>
          console.warn("agents: default model", e),
        );
        // The model can change the effort options: plan again on fresh controls.
        const fresh = get().sessions[sessionId];
        if (!fresh) return;
        plan = planDefaults(view.agentId, fresh.controls, settings, { skipModel: true });
      }
      for (const change of plan) {
        await applyChange(sessionId, change, false).catch((e) =>
          console.warn("agents: default", change.key, e),
        );
      }
    }

    function authMethods(agentId: AgentId): AcpAuthMethod[] {
      const st = get().agents[agentId].status;
      return st.state === "authRequired" || st.state === "ready" ? st.authMethods : [];
    }

    return {
      ...createAgentData(),
      selectedAgent: deps.settings().defaultAgent,
      activeSessionId: null,
      history: [],
      historyLoading: false,
      historyError: null,

      init: () => {
        initPromise ??= (async () => {
          try {
            await deps.ipc.subscribe((e) => get().ingest(e));
          } catch (err) {
            console.error("agents: subscribe failed", err);
          }
          set({ selectedAgent: deps.settings().defaultAgent });
          await get().refreshAgents();
        })();
        return initPromise;
      },

      ingest: (event) => {
        queue.push(event);
        if (scheduled) return;
        scheduled = true;
        deps.schedule(() => get().flush());
      },

      flush: () => {
        scheduled = false;
        if (queue.length === 0) return;
        const events = queue;
        queue = [];
        const prev = get().sessions;
        const next = reduceEvents(data(), events, deps.now());
        set({ agents: next.agents, sessions: next.sessions, orphans: next.orphans });
        // A finished turn sends the next queued prompt (not after stop or failure).
        for (const [id, v] of Object.entries(next.sessions)) {
          const p = prev[id];
          if (!p || p.turn === "idle" || v.turn !== "idle") continue;
          if (v.lastStopReason === "cancelled" || v.error || v.queued.length === 0) continue;
          const [first, ...rest] = v.queued;
          patch(id, (s) => ({ ...s, queued: rest }));
          void send(id, first);
        }
      },

      refreshAgents: async () => {
        try {
          const list = await deps.ipc.list();
          const agents = { ...get().agents };
          for (const info of list) agents[info.id] = info;
          set({ agents });
        } catch (err) {
          console.error("agents: list failed", err);
        }
      },

      refreshHistory: async (cwd) => {
        const s = get();
        const ids = AGENT_IDS.filter(
          (id) =>
            id === s.selectedAgent ||
            s.agents[id].status.state === "ready" ||
            Object.values(s.sessions).some((v) => v.agentId === id),
        );
        set({ historyLoading: true, historyError: null });
        const results = await Promise.allSettled(ids.map((id) => deps.ipc.sessionsList(id, cwd)));
        const fresh: AgentSessionInfo[] = [];
        const errors: string[] = [];
        results.forEach((r, i) => {
          if (r.status === "fulfilled") fresh.push(...r.value);
          else errors.push(`${get().agents[ids[i]].displayName}: ${errorMessage(r.reason)}`);
        });
        const keys = new Set(fresh.map((h) => `${h.agentId}:${h.sessionId}`));
        const kept = get().history.filter(
          (h) => !sameProject(h.cwd, cwd) && !keys.has(`${h.agentId}:${h.sessionId}`),
        );
        set({
          history: [...kept, ...fresh],
          historyLoading: false,
          historyError: errors.length > 0 ? errors.join("\n") : null,
        });
      },

      listSessions: (agentId, cwd) => deps.ipc.sessionsList(agentId, cwd),

      selectAgent: (agentId) => set({ selectedAgent: agentId }),

      setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),

      newSession: async (agentId, cwd) => {
        const setup = await deps.ipc.sessionNew(agentId, cwd);
        const now = deps.now();
        const view = createSessionView(setup, cwd, { updatedAt: new Date(now).toISOString() });
        const next = attachSession(data(), view, now);
        set({
          sessions: next.sessions,
          orphans: next.orphans,
          activeSessionId: setup.sessionId,
          selectedAgent: agentId,
        });
        await applyDefaults(setup.sessionId);
        return setup.sessionId;
      },

      loadSession: async (agentId, sessionId, cwd) => {
        if (get().sessions[sessionId]) {
          set({ activeSessionId: sessionId });
          return;
        }
        const known = get().history.find((h) => h.agentId === agentId && h.sessionId === sessionId);
        const placeholder = createSessionView(
          {
            sessionId,
            agentId,
            modes: null,
            configOptions: null,
            models: null,
            agentCapabilities: {},
          },
          cwd,
          { loading: true, title: known?.title ?? null, updatedAt: known?.updatedAt ?? null },
        );
        const next = attachSession(data(), placeholder, deps.now());
        set({
          sessions: next.sessions,
          orphans: next.orphans,
          activeSessionId: sessionId,
          selectedAgent: agentId,
        });
        try {
          const setup = await deps.ipc.sessionLoad(agentId, sessionId, cwd);
          get().flush(); // replay events precede the response
          patch(sessionId, (v) => ({
            ...withSource(v, {
              configOptions: setup.configOptions,
              modes: setup.modes,
              models: setup.models,
            }),
            capabilities: setup.agentCapabilities,
            loading: false,
          }));
        } catch (err) {
          const message = errorMessage(err);
          patch(sessionId, (v) =>
            notice({ ...v, loading: false, error: { message, code: null } }, message),
          );
          throw err;
        }
      },

      closeSession: async (sessionId) => {
        const sessions = { ...get().sessions };
        if (!sessions[sessionId]) return;
        delete sessions[sessionId];
        set({
          sessions,
          activeSessionId: get().activeSessionId === sessionId ? null : get().activeSessionId,
        });
        await deps.ipc.sessionClose(sessionId).catch((e) => console.warn("agents: close", e));
      },

      pinSession: async ({ agentId, sessionId, cwd }, pinned) => {
        await deps.ipc.sessionPin(agentId, sessionId, cwd, pinned);
        set({ history: patchHistory(get().history, { agentId, sessionId, cwd }, { pinned }) });
      },

      renameSession: async ({ agentId, sessionId, cwd }, title) => {
        const name = title?.trim() || null;
        await deps.ipc.sessionRename(agentId, sessionId, cwd, name);
        set({
          history: patchHistory(get().history, { agentId, sessionId, cwd }, { customTitle: name }),
        });
      },

      archiveSession: async ({ agentId, sessionId, cwd }, archived) => {
        await deps.ipc.sessionArchive(agentId, sessionId, cwd, archived);
        const known = get().history.some((h) => h.agentId === agentId && h.sessionId === sessionId);
        set({
          history: known
            ? get().history.map((h) =>
                h.agentId === agentId && h.sessionId === sessionId ? { ...h, archived } : h,
              )
            : [
                ...get().history,
                { agentId, sessionId, cwd, title: null, updatedAt: null, archived },
              ],
          activeSessionId:
            archived && get().activeSessionId === sessionId ? null : get().activeSessionId,
        });
      },

      deleteSession: async ({ agentId, sessionId, cwd }) => {
        await deps.ipc.sessionDelete(agentId, sessionId, cwd);
        const sessions = { ...get().sessions };
        delete sessions[sessionId];
        set({
          sessions,
          history: get().history.filter(
            (h) => !(h.agentId === agentId && h.sessionId === sessionId),
          ),
          activeSessionId: get().activeSessionId === sessionId ? null : get().activeSessionId,
        });
      },

      prompt: async (sessionId, input) => {
        const v = get().sessions[sessionId];
        if (!v) return;
        const blocks = textBlocks(input);
        if (v.turn !== "idle") {
          patch(sessionId, (s) => ({ ...s, queued: [...s.queued, blocks] }));
          return;
        }
        await send(sessionId, blocks);
      },

      dropQueued: (sessionId, index) =>
        patch(sessionId, (v) => ({ ...v, queued: v.queued.filter((_, i) => i !== index) })),

      cancel: async (sessionId) => {
        const v = get().sessions[sessionId];
        if (!v || v.turn === "idle") return;
        patch(sessionId, (s) => ({ ...s, turn: "cancelling", queued: [], permissions: [] }));
        try {
          await deps.ipc.cancel(sessionId);
        } catch (err) {
          console.error("agents: cancel failed", err);
          patch(sessionId, (s) => (s.turn === "cancelling" ? { ...s, turn: "running" } : s));
        }
      },

      setControl: async (sessionId, key, value) => {
        const v = get().sessions[sessionId];
        const control: Control | undefined = v && findControl(v.controls, key);
        if (!control) return;
        await applyChange(sessionId, { key, via: control.via, value }, true);
      },

      respondPermission: async (requestId, optionId) => {
        const owner = Object.values(get().sessions).find((v) =>
          v.permissions.some((p) => p.requestId === requestId),
        );
        const pending = owner?.permissions.find((p) => p.requestId === requestId);
        if (owner) {
          patch(owner.sessionId, (v) => ({
            ...v,
            permissions: v.permissions.filter((p) => p.requestId !== requestId),
          }));
        }
        try {
          await deps.ipc.permissionRespond(requestId, optionId);
        } catch (err) {
          console.error("agents: permission response failed", err);
          if (owner && pending) {
            patch(owner.sessionId, (v) => ({ ...v, permissions: [...v.permissions, pending] }));
          }
          throw err;
        }
      },

      install: async (agentId) => {
        await deps.ipc.install(agentId);
        await get().refreshAgents();
      },

      authenticate: async (agentId, methodId) => {
        const method = authMethods(agentId).find((m) => m.id === methodId);
        if (method?.type === "terminal") await deps.ipc.authTerminal(agentId, methodId);
        else await deps.ipc.authenticate(agentId, methodId);
      },

      restart: async (agentId) => {
        const views = Object.values(get().sessions).filter((v) => v.agentId === agentId);
        if (views.length === 0) {
          await get().refreshAgents();
          return;
        }
        for (const v of views) {
          const canResume = !!v.capabilities.sessionCapabilities?.resume;
          try {
            if (!canResume) {
              // A load replays the whole transcript, so start from an empty one.
              patch(v.sessionId, (s) => ({ ...s, items: [], permissions: [], loading: true }));
            }
            const setup = canResume
              ? await deps.ipc.sessionResume(agentId, v.sessionId, v.cwd)
              : await deps.ipc.sessionLoad(agentId, v.sessionId, v.cwd);
            get().flush();
            patch(v.sessionId, (s) => ({
              ...withSource(s, {
                configOptions: setup.configOptions,
                modes: setup.modes,
                models: setup.models,
              }),
              capabilities: setup.agentCapabilities,
              loading: false,
              error: null,
            }));
          } catch (err) {
            const message = errorMessage(err);
            patch(v.sessionId, (s) =>
              notice({ ...s, loading: false, error: { message, code: null } }, message),
            );
          }
        }
      },

      acceptChanges: (sessionId) => patch(sessionId, (v) => ({ ...v, changes: [] })),

      revertChange: async (sessionId, path) => {
        const result = await deps.ipc.reviewRevert(sessionId, path);
        if (result === "reverted") {
          patch(sessionId, (v) => ({ ...v, changes: v.changes.filter((c) => c.path !== path) }));
        }
        return result;
      },

      shutdown: () => deps.ipc.shutdown(),
    };
  });
}

export type AgentStore = ReturnType<typeof createAgentStore>;

// --- Default instance ------------------------------------------------------------------

let currentIpc: AgentIpc = tauriAgentIpc;

/** Swaps the ipc behind the default store (the `?fixture=` dev mode uses a fake). */
export function setAgentIpc(ipc: AgentIpc) {
  currentIpc = ipc;
}

/** Forwards to whatever {@link setAgentIpc} installed last. */
const switchableIpc = new Proxy({} as AgentIpc, {
  get: (_, key: keyof AgentIpc) => currentIpc[key],
});

/** History with one entry's local marks changed (added when not listed yet). */
function patchHistory(
  history: AgentSessionInfo[],
  { agentId, sessionId, cwd }: Pick<AgentSessionInfo, "agentId" | "sessionId" | "cwd">,
  patch: Partial<AgentSessionInfo>,
): AgentSessionInfo[] {
  const known = history.some((h) => h.agentId === agentId && h.sessionId === sessionId);
  return known
    ? history.map((h) =>
        h.agentId === agentId && h.sessionId === sessionId ? { ...h, ...patch } : h,
      )
    : [...history, { agentId, sessionId, cwd, title: null, updatedAt: null, ...patch }];
}

export const useAgentStore = createAgentStore({ ipc: switchableIpc });

// --- Selectors -------------------------------------------------------------------------

export const selectActiveSession = (s: AgentStoreState): SessionView | null =>
  (s.activeSessionId && s.sessions[s.activeSessionId]) || null;

/** Memoised on its inputs so it is safe as a zustand selector. */
function memo<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  let last: A | null = null;
  let value: R;
  return (...args) => {
    if (last && args.length === last.length && args.every((a, i) => a === last![i])) return value;
    last = args;
    value = fn(...args);
    return value;
  };
}

const sessionList = memo(mergeSessionList);
const projectGroups = memo(groupByProject);

export const selectSessionList = (s: AgentStoreState): SessionListEntry[] =>
  sessionList(s.history, s.sessions, s.activeSessionId);

export const selectProjectGroups = (s: AgentStoreState): ProjectGroup[] =>
  projectGroups(selectSessionList(s));
