// AgentEvent -> view state (design 4.2). Pure: `now` is passed in. A batch is
// applied with copy-on-write drafts, so a frame of hundreds of chunks copies
// each touched session and item once instead of once per event.

import { deriveControls, type ControlSource, type SessionControls } from "./controls";
import type {
  AcpAgentCapabilities,
  AcpCommand,
  AcpContentBlock,
  AcpPermissionOption,
  AcpPlanEntry,
  AcpSessionUpdate,
  AcpStopReason,
  AcpToolCall,
  AcpToolCallUpdate,
  AgentEvent,
  AgentId,
  AgentInfo,
  SessionSetup,
} from "./types";

// --- View model ----------------------------------------------------------------

export type ChatItem =
  | { kind: "user"; id: string; blocks: AcpContentBlock[] }
  | { kind: "agent"; id: string; text: string }
  | { kind: "thought"; id: string; text: string; startedAt: number; endedAt: number | null }
  | { kind: "tool"; id: string; call: AcpToolCall; startedAt: number; endedAt: number | null }
  | { kind: "plan"; id: string; entries: AcpPlanEntry[] }
  | { kind: "notice"; id: string; severity: string; title: string };

export interface PendingPermission {
  requestId: string;
  sessionId: string;
  toolCall: AcpToolCallUpdate;
  options: AcpPermissionOption[];
}

export interface TerminalView {
  output: string;
  /** True once old output was dropped to stay under {@link TERMINAL_OUTPUT_LIMIT}. */
  truncated: boolean;
  exitCode: number | null;
  signal: string | null;
  exited: boolean;
}

/** A file the agent changed since the last "accept". */
export interface ReviewChange {
  path: string;
  /** Content before the first change; `null` = new file, `undefined` = unknown (snapshot in Rust). */
  oldText: string | null | undefined;
  newText: string | undefined;
}

export type TurnState = "idle" | "running" | "cancelling";

export interface SessionView {
  sessionId: string;
  agentId: AgentId;
  cwd: string;
  title: string | null;
  updatedAt: string | null;
  items: ChatItem[];
  turn: TurnState;
  lastStopReason: AcpStopReason | null;
  error: { message: string; code: number | null } | null;
  /** Raw control state; `controls` is derived from it. */
  source: ControlSource;
  controls: SessionControls;
  commands: AcpCommand[];
  usage: { used: number; size: number; cost?: { amount: number; currency: string } | null } | null;
  permissions: PendingPermission[];
  terminals: Record<string, TerminalView>;
  changes: ReviewChange[];
  /** Prompts typed while a turn was running; sent one by one afterwards. */
  queued: AcpContentBlock[][];
  /** `session/load` replay in progress. */
  loading: boolean;
  capabilities: AcpAgentCapabilities;
  /** Counter for local item ids. */
  nextId: number;
}

export interface AgentData {
  agents: Record<AgentId, AgentInfo>;
  sessions: Record<string, SessionView>;
  /** Events for sessions not attached yet (e.g. replay racing the load response). */
  orphans: Record<string, AgentEvent[]>;
}

export const AGENT_IDS: readonly AgentId[] = ["claude", "codex", "gemini"];
export const AGENT_NAMES: Record<AgentId, string> = {
  claude: "Claude",
  codex: "Codex",
  gemini: "Gemini",
};

/** Max characters of terminal output kept per terminal (tail). */
export const TERMINAL_OUTPUT_LIMIT = 256 * 1024;
/** Max buffered events per unknown session. */
export const ORPHAN_LIMIT = 2_000;

export function createAgentData(): AgentData {
  const agents = {} as Record<AgentId, AgentInfo>;
  for (const id of AGENT_IDS) {
    agents[id] = { id, displayName: AGENT_NAMES[id], version: "", status: { state: "stopped" } };
  }
  return { agents, sessions: {}, orphans: {} };
}

export function createSessionView(
  setup: SessionSetup,
  cwd: string,
  extra: Partial<SessionView> = {},
): SessionView {
  const source: ControlSource = {
    configOptions: setup.configOptions,
    modes: setup.modes,
    models: setup.models,
  };
  return {
    sessionId: setup.sessionId,
    agentId: setup.agentId,
    cwd,
    title: null,
    updatedAt: null,
    items: [],
    turn: "idle",
    lastStopReason: null,
    error: null,
    source,
    controls: deriveControls(source),
    commands: [],
    usage: null,
    permissions: [],
    terminals: {},
    changes: [],
    queued: [],
    loading: false,
    capabilities: setup.agentCapabilities,
    nextId: 1,
    ...extra,
  };
}

/** Replaces the control source and re-derives the controls. */
export function withSource(view: SessionView, source: ControlSource): SessionView {
  return { ...view, source, controls: deriveControls(source) };
}

// --- Drafts --------------------------------------------------------------------

class SessionDraft {
  readonly view: SessionView;
  private readonly fresh = new WeakSet<object>();

  constructor(base: SessionView) {
    this.view = { ...base, items: base.items.slice() };
  }

  /** Returns item `i`, copied once per batch so it can be mutated. */
  own(i: number): ChatItem {
    const item = this.view.items[i];
    if (this.fresh.has(item)) return item;
    const copy = { ...item };
    this.fresh.add(copy);
    this.view.items[i] = copy;
    return copy;
  }

  last(): ChatItem | undefined {
    return this.view.items[this.view.items.length - 1];
  }

  push(make: (id: string) => ChatItem, now: number): ChatItem {
    this.closeThought(now);
    const v = this.view;
    const item = make("");
    if (item.kind !== "tool") item.id = `${item.kind}-${v.nextId++}`;
    this.fresh.add(item);
    v.items.push(item);
    return item;
  }

  closeThought(now: number) {
    const i = this.view.items.length - 1;
    const last = this.view.items[i];
    if (last?.kind === "thought" && last.endedAt === null) {
      (this.own(i) as Extract<ChatItem, { kind: "thought" }>).endedAt = now;
    }
  }

  findTool(toolCallId: string): number {
    const items = this.view.items;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.kind === "tool" && it.id === toolCallId) return i;
    }
    return -1;
  }
}

// --- Helpers -------------------------------------------------------------------

function blockText(block: AcpContentBlock): string {
  switch (block.type) {
    case "text":
      return block.text;
    case "resource_link":
      return `[${block.name}](${block.uri})`;
    case "resource":
      return block.resource.text ?? "";
    default:
      return "";
  }
}

const DONE_STATUSES = new Set(["completed", "failed"]);

function mergeCall(base: AcpToolCall, update: AcpToolCallUpdate): AcpToolCall {
  const next: AcpToolCall = { ...base };
  for (const [k, v] of Object.entries(update)) {
    if (k === "sessionUpdate" || v === undefined) continue;
    (next as unknown as Record<string, unknown>)[k] = v;
  }
  return next;
}

function upsertTool(d: SessionDraft, update: AcpToolCallUpdate, now: number) {
  const i = d.findTool(update.toolCallId);
  let call: AcpToolCall;
  if (i >= 0) {
    const item = d.own(i) as Extract<ChatItem, { kind: "tool" }>;
    item.call = mergeCall(item.call, update);
    if (item.endedAt === null && item.call.status && DONE_STATUSES.has(item.call.status)) {
      item.endedAt = now;
    }
    call = item.call;
  } else {
    call = mergeCall({ toolCallId: update.toolCallId, title: "" }, update);
    d.push(
      () => ({
        kind: "tool",
        id: call.toolCallId,
        call,
        startedAt: now,
        endedAt: call.status && DONE_STATUSES.has(call.status) ? now : null,
      }),
      now,
    );
  }
  if (call.status === "completed") recordDiffs(d, call);
}

function recordChange(d: SessionDraft, change: ReviewChange) {
  const v = d.view;
  const idx = v.changes.findIndex((c) => c.path === change.path);
  if (idx < 0) {
    v.changes = [...v.changes, change];
    return;
  }
  const prev = v.changes[idx];
  const merged: ReviewChange = {
    path: prev.path,
    // The first known "before" content wins.
    oldText: prev.oldText !== undefined ? prev.oldText : change.oldText,
    newText: change.newText !== undefined ? change.newText : prev.newText,
  };
  v.changes = v.changes.map((c, i) => (i === idx ? merged : c));
}

function recordDiffs(d: SessionDraft, call: AcpToolCall) {
  for (const c of call.content ?? []) {
    if (c.type === "diff")
      recordChange(d, { path: c.path, oldText: c.oldText, newText: c.newText });
  }
}

function applyUpdate(d: SessionDraft, update: AcpSessionUpdate, now: number) {
  const v = d.view;
  const u = update as AcpSessionUpdate & Record<string, unknown>;
  switch (update.sessionUpdate) {
    case "agent_message_chunk":
    case "agent_thought_chunk": {
      const chunk = blockText((u as { content: AcpContentBlock }).content);
      const kind = update.sessionUpdate === "agent_message_chunk" ? "agent" : "thought";
      const last = d.last();
      if (
        last?.kind === kind &&
        (kind === "agent" || (last.kind === "thought" && last.endedAt === null))
      ) {
        const item = d.own(v.items.length - 1) as { text: string };
        item.text += chunk;
      } else if (kind === "agent") {
        if (chunk) d.push((id) => ({ kind: "agent", id, text: chunk }), now);
      } else {
        d.push((id) => ({ kind: "thought", id, text: chunk, startedAt: now, endedAt: null }), now);
      }
      return;
    }
    case "user_message_chunk": {
      const block = (u as { content: AcpContentBlock }).content;
      const last = d.last();
      if (last?.kind === "user") {
        const item = d.own(v.items.length - 1) as Extract<ChatItem, { kind: "user" }>;
        const blocks = item.blocks.slice();
        const tail = blocks[blocks.length - 1];
        if (block.type === "text" && tail?.type === "text") {
          blocks[blocks.length - 1] = { type: "text", text: tail.text + block.text };
        } else {
          blocks.push(block);
        }
        item.blocks = blocks;
      } else {
        d.push((id) => ({ kind: "user", id, blocks: [block] }), now);
      }
      return;
    }
    case "tool_call":
    case "tool_call_update":
      upsertTool(d, u as unknown as AcpToolCallUpdate, now);
      return;
    case "plan": {
      const entries = (u as { entries: AcpPlanEntry[] }).entries;
      const i = v.items.findIndex((it) => it.kind === "plan");
      if (i >= 0) (d.own(i) as Extract<ChatItem, { kind: "plan" }>).entries = entries;
      else d.push((id) => ({ kind: "plan", id, entries }), now);
      return;
    }
    case "available_commands_update":
      v.commands = (u as { availableCommands: AcpCommand[] }).availableCommands;
      return;
    case "current_mode_update": {
      const modeId = (u as { currentModeId: string }).currentModeId;
      if (v.source.modes) {
        v.source = { ...v.source, modes: { ...v.source.modes, currentModeId: modeId } };
        v.controls = deriveControls(v.source);
      }
      return;
    }
    case "config_option_update":
      v.source = {
        ...v.source,
        configOptions: (u as { configOptions: SessionSetup["configOptions"] }).configOptions,
      };
      v.controls = deriveControls(v.source);
      return;
    case "session_info_update":
      if ("title" in u && u.title !== undefined) v.title = (u.title as string | null) ?? null;
      if ("updatedAt" in u && u.updatedAt !== undefined)
        v.updatedAt = (u.updatedAt as string | null) ?? null;
      return;
    case "usage_update": {
      const { used, size, cost } = u as {
        used: number;
        size: number;
        cost?: { amount: number; currency: string } | null;
      };
      v.usage = cost === undefined ? { used, size } : { used, size, cost };
      return;
    }
    case "notice": {
      const { severity, title } = u as { severity: string; title: string };
      d.push((id) => ({ kind: "notice", id, severity, title }), now);
      return;
    }
    default:
      console.debug("agents: ignoring session update", update.sessionUpdate);
  }
}

function appendTerminal(prev: TerminalView | undefined, chunk: string): TerminalView {
  const base = prev ?? {
    output: "",
    truncated: false,
    exitCode: null,
    signal: null,
    exited: false,
  };
  let output = base.output + chunk;
  let truncated = base.truncated;
  if (output.length > TERMINAL_OUTPUT_LIMIT) {
    output = output.slice(output.length - TERMINAL_OUTPUT_LIMIT);
    truncated = true;
  }
  return { ...base, output, truncated };
}

function applySessionEvent(d: SessionDraft, ev: AgentEvent, now: number) {
  const v = d.view;
  switch (ev.type) {
    case "sessionUpdate":
      applyUpdate(d, ev.update, now);
      return;
    case "permissionRequested":
      v.permissions = [
        ...v.permissions,
        {
          requestId: ev.requestId,
          sessionId: ev.sessionId,
          toolCall: ev.toolCall,
          options: ev.options,
        },
      ];
      upsertTool(d, ev.toolCall, now);
      return;
    case "turnEnded":
      d.closeThought(now);
      v.turn = "idle";
      v.lastStopReason = ev.stopReason;
      return;
    case "turnFailed":
      d.closeThought(now);
      v.turn = "idle";
      v.error = { message: ev.message, code: ev.code };
      d.push((id) => ({ kind: "notice", id, severity: "error", title: ev.message }), now);
      return;
    case "fileWritten":
      recordChange(d, { path: ev.path, oldText: undefined, newText: undefined });
      return;
    case "terminalOutput":
      v.terminals = {
        ...v.terminals,
        [ev.terminalId]: appendTerminal(v.terminals[ev.terminalId], ev.chunk),
      };
      return;
    case "terminalExited":
      v.terminals = {
        ...v.terminals,
        [ev.terminalId]: {
          ...appendTerminal(v.terminals[ev.terminalId], ""),
          exitCode: ev.exitCode,
          signal: ev.signal,
          exited: true,
        },
      };
      return;
  }
}

// --- Entry points ----------------------------------------------------------------

/** Applies a batch of events in order. Returns `data` itself when nothing changed. */
export function reduceEvents(
  data: AgentData,
  events: readonly AgentEvent[],
  now: number,
): AgentData {
  if (events.length === 0) return data;
  const drafts = new Map<string, SessionDraft>();
  let agents = data.agents;
  let orphans = data.orphans;

  const draftFor = (sessionId: string): SessionDraft | undefined => {
    let d = drafts.get(sessionId);
    if (!d) {
      const base = data.sessions[sessionId];
      if (!base) return undefined;
      d = new SessionDraft(base);
      drafts.set(sessionId, d);
    }
    return d;
  };

  for (const ev of events) {
    if (ev.type === "agentStatus") {
      agents = { ...agents, [ev.agentId]: { ...agents[ev.agentId], status: ev.status } };
      if (ev.status.state === "crashed" || ev.status.state === "stopped") {
        for (const s of Object.values(data.sessions)) {
          if (s.agentId !== ev.agentId) continue;
          const d = draftFor(s.sessionId);
          if (d && d.view.turn !== "idle") {
            d.closeThought(now);
            d.view.turn = "idle";
          }
        }
      }
      continue;
    }
    if (ev.type === "permissionResolved") {
      for (const s of Object.values(data.sessions)) {
        const current = drafts.get(s.sessionId)?.view ?? s;
        if (!current.permissions.some((p) => p.requestId === ev.requestId)) continue;
        const d = draftFor(s.sessionId)!;
        d.view.permissions = d.view.permissions.filter((p) => p.requestId !== ev.requestId);
      }
      continue;
    }
    const d = draftFor(ev.sessionId);
    if (!d) {
      const list = orphans[ev.sessionId] ?? [];
      if (list.length < ORPHAN_LIMIT) orphans = { ...orphans, [ev.sessionId]: [...list, ev] };
      continue;
    }
    applySessionEvent(d, ev, now);
  }

  let sessions = data.sessions;
  if (drafts.size > 0) {
    sessions = { ...sessions };
    for (const [id, d] of drafts) sessions[id] = d.view;
  }
  return { agents, sessions, orphans };
}

/** Adds (or replaces) a session and replays events that arrived before it. */
/**
 * Starts a turn locally: appends the user's message (agents echo user chunks
 * only on replay) and marks the session running.
 */
export function beginTurn(view: SessionView, blocks: AcpContentBlock[], now: number): SessionView {
  const d = new SessionDraft(view);
  d.push((id) => ({ kind: "user", id, blocks }), now);
  Object.assign(d.view, {
    turn: "running",
    error: null,
    lastStopReason: null,
    updatedAt: new Date(now).toISOString(),
  } satisfies Partial<SessionView>);
  return d.view;
}

export function attachSession(data: AgentData, view: SessionView, now: number): AgentData {
  const pending = data.orphans[view.sessionId];
  const orphans = { ...data.orphans };
  delete orphans[view.sessionId];
  const next: AgentData = {
    ...data,
    sessions: { ...data.sessions, [view.sessionId]: view },
    orphans,
  };
  return pending ? reduceEvents(next, pending, now) : next;
}
