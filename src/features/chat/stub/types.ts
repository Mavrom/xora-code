// TEMPORARY stub of package C's view model (`@/features/agents/{controls,reducer,store}`),
// mirroring the shape C confirmed. Deleted once C's store lands; only the chat seam
// (`useChat.ts`) and the dev fixtures import from here.
import type {
  AcpAgentCapabilities,
  AcpCommand,
  AcpContentBlock,
  AcpPermissionOption,
  AcpPlanEntry,
  AcpStopReason,
  AcpToolCall,
  AcpToolCallUpdate,
  AgentId,
} from "@/features/agents/types";

// --- §4.4 controls ---
export interface SelectControl {
  key: string;
  via: "config" | "mode" | "model";
  label: string;
  current: string;
  options: { value: string; name: string; description?: string; group?: string }[];
}
export interface ToggleControl {
  key: string;
  via: "config";
  label: string;
  current: boolean;
  boolean: boolean;
}
export interface SessionControls {
  model?: SelectControl;
  mode?: SelectControl;
  effort?: SelectControl;
  extra: (SelectControl | ToggleControl)[];
}

// --- reducer view model ---
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
  exitCode: number | null;
  exited: boolean;
}

/** A file the agent changed since the last accept; `oldText` null = new file, undefined = unknown. */
export interface ReviewChange {
  path: string;
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
  capabilities: AcpAgentCapabilities;
  items: ChatItem[];
  turn: TurnState;
  lastStopReason: AcpStopReason | null;
  error: { message: string; code: number | null } | null;
  controls: SessionControls;
  commands: AcpCommand[];
  usage: { used: number; size: number; cost?: { amount: number; currency: string } | null } | null;
  permissions: PendingPermission[];
  terminals: Record<string, TerminalView>;
  changes: ReviewChange[];
  queued: AcpContentBlock[][];
  loading: boolean;
}
