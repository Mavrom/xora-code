// Shared event contract between Rust (`src-tauri/src/agents/events.rs`) and the
// frontend. Mirrors design doc section 5.1 exactly; change both sides together.

export type AgentId = "claude" | "codex" | "gemini";

export type AgentStatus =
  | { state: "notInstalled"; reason: "node-missing" | "node-too-old" | "package-missing" }
  | { state: "installing"; progress: number | null }
  | { state: "starting" }
  | {
      state: "ready";
      agentInfo: AcpImplementation | null;
      capabilities: AcpAgentCapabilities;
      authMethods: AcpAuthMethod[];
    }
  | { state: "authRequired"; authMethods: AcpAuthMethod[] }
  | { state: "crashed"; code: number | null; stderrTail: string[] }
  | { state: "stopped" };

export type AgentEvent =
  | { type: "agentStatus"; agentId: AgentId; status: AgentStatus }
  | { type: "sessionUpdate"; sessionId: string; update: AcpSessionUpdate }
  | {
      type: "permissionRequested";
      requestId: string;
      sessionId: string;
      toolCall: AcpToolCallUpdate;
      options: AcpPermissionOption[];
    }
  | { type: "permissionResolved"; requestId: string; optionId: string | null }
  | { type: "turnEnded"; sessionId: string; stopReason: AcpStopReason }
  | { type: "turnFailed"; sessionId: string; message: string; code: number | null }
  | { type: "fileWritten"; sessionId: string; path: string }
  | { type: "terminalOutput"; sessionId: string; terminalId: string; chunk: string }
  | {
      type: "terminalExited";
      sessionId: string;
      terminalId: string;
      exitCode: number | null;
      signal: string | null;
    };

export interface SessionSetup {
  sessionId: string;
  agentId: AgentId;
  modes: AcpSessionModeState | null;
  configOptions: AcpConfigOption[] | null;
  models: {
    availableModels: { modelId: string; name: string; description?: string | null }[];
    currentModelId: string;
  } | null;
  agentCapabilities: AcpAgentCapabilities;
}

// --- ACP v1 subset (schema-v1.26.0), hand-written; unknown fields tolerated ---
export type AcpStopReason =
  "end_turn" | "max_tokens" | "max_turn_requests" | "refusal" | "cancelled";
export type AcpContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string; uri?: string | null }
  | { type: "resource_link"; uri: string; name: string; mimeType?: string | null }
  | { type: "resource"; resource: { uri: string; text?: string; mimeType?: string | null } };
export type AcpToolKind =
  | "read"
  | "edit"
  | "delete"
  | "move"
  | "search"
  | "execute"
  | "think"
  | "fetch"
  | "switch_mode"
  | "other";
export type AcpToolStatus = "pending" | "in_progress" | "completed" | "failed";
export type AcpToolContent =
  | { type: "content"; content: AcpContentBlock }
  | { type: "diff"; path: string; oldText?: string | null; newText: string }
  | { type: "terminal"; terminalId: string };
export interface AcpToolCall {
  toolCallId: string;
  title: string;
  name?: string | null;
  kind?: AcpToolKind;
  status?: AcpToolStatus;
  content?: AcpToolContent[];
  locations?: { path: string; line?: number | null }[];
  rawInput?: unknown;
  rawOutput?: unknown;
}
export type AcpToolCallUpdate = Partial<Omit<AcpToolCall, "toolCallId">> & { toolCallId: string };
export interface AcpPlanEntry {
  content: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "in_progress" | "completed";
}
export interface AcpCommand {
  name: string;
  description: string;
  input?: { hint: string } | null;
}
export interface AcpSelectOption {
  value: string;
  name: string;
  description?: string | null;
}
export interface AcpSelectGroup {
  group: string;
  name: string;
  options: AcpSelectOption[];
}
export type AcpConfigOption = {
  id: string;
  name: string;
  description?: string | null;
  category?: "mode" | "model" | "model_config" | "thought_level" | (string & {}) | null;
} & (
  | { type: "select"; currentValue: string; options: AcpSelectOption[] | AcpSelectGroup[] }
  | { type: "boolean"; currentValue: boolean }
);
export interface AcpSessionModeState {
  currentModeId: string;
  availableModes: { id: string; name: string; description?: string | null }[];
}
export type AcpSessionUpdate =
  | {
      sessionUpdate: "user_message_chunk" | "agent_message_chunk" | "agent_thought_chunk";
      content: AcpContentBlock;
    }
  | ({ sessionUpdate: "tool_call" } & AcpToolCall)
  | ({ sessionUpdate: "tool_call_update" } & AcpToolCallUpdate)
  | { sessionUpdate: "plan"; entries: AcpPlanEntry[] }
  | { sessionUpdate: "available_commands_update"; availableCommands: AcpCommand[] }
  | { sessionUpdate: "current_mode_update"; currentModeId: string }
  | { sessionUpdate: "config_option_update"; configOptions: AcpConfigOption[] }
  | { sessionUpdate: "session_info_update"; title?: string | null; updatedAt?: string | null }
  | {
      sessionUpdate: "usage_update";
      used: number;
      size: number;
      cost?: { amount: number; currency: string } | null;
    }
  | { sessionUpdate: "notice"; severity: string; title: string }
  | { sessionUpdate: string; [k: string]: unknown }; // unknown kinds: ignored by the reducer
export interface AcpPermissionOption {
  optionId: string;
  name: string;
  kind: "allow_once" | "allow_always" | "reject_once" | "reject_always";
}
export interface AcpAuthMethod {
  id: string;
  name: string;
  description?: string | null;
  type?: "agent" | "terminal";
  args?: string[];
  env?: Record<string, string>;
}
export interface AcpImplementation {
  name: string;
  title?: string | null;
  version: string;
}
export interface AcpAgentCapabilities {
  loadSession?: boolean;
  promptCapabilities?: { image?: boolean; audio?: boolean; embeddedContext?: boolean };
  sessionCapabilities?: {
    list?: object | null;
    resume?: object | null;
    close?: object | null;
    delete?: object | null;
  };
}
export interface AgentSessionInfo {
  agentId: AgentId;
  sessionId: string;
  cwd: string;
  title: string | null;
  updatedAt: string | null;
  /** In the archive (a local mark); absent on older entries. */
  archived?: boolean;
}
export interface AgentInfo {
  id: AgentId;
  displayName: string;
  version: string;
  status: AgentStatus;
}
