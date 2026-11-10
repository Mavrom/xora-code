// Typed wrappers around the agent Tauri commands. The store talks
// to the `AgentIpc` interface, so tests and the `?fixture=` dev mode can swap
// in a fake.

import { Channel, invoke } from "@tauri-apps/api/core";
import type {
  AcpConfigOption,
  AcpContentBlock,
  AgentEvent,
  AgentId,
  AgentInfo,
  AgentSessionInfo,
  SessionSetup,
} from "./types";

export interface AgentIpc {
  /** Starts the single event stream. Calling again replaces the old channel. */
  subscribe: (onEvent: (event: AgentEvent) => void) => Promise<void>;
  list: () => Promise<AgentInfo[]>;
  install: (agentId: AgentId) => Promise<void>;
  authenticate: (agentId: AgentId, methodId: string) => Promise<void>;
  authTerminal: (agentId: AgentId, methodId: string) => Promise<void>;
  sessionNew: (agentId: AgentId, cwd: string) => Promise<SessionSetup>;
  sessionLoad: (agentId: AgentId, sessionId: string, cwd: string) => Promise<SessionSetup>;
  sessionResume: (agentId: AgentId, sessionId: string, cwd: string) => Promise<SessionSetup>;
  sessionClose: (sessionId: string) => Promise<void>;
  sessionsList: (agentId: AgentId, cwd: string) => Promise<AgentSessionInfo[]>;
  sessionArchive: (
    agentId: AgentId,
    sessionId: string,
    cwd: string,
    archived: boolean,
  ) => Promise<void>;
  sessionDelete: (agentId: AgentId, sessionId: string, cwd: string) => Promise<void>;
  sessionPin: (agentId: AgentId, sessionId: string, cwd: string, pinned: boolean) => Promise<void>;
  sessionRename: (
    agentId: AgentId,
    sessionId: string,
    cwd: string,
    title: string | null,
  ) => Promise<void>;
  prompt: (sessionId: string, blocks: AcpContentBlock[]) => Promise<void>;
  cancel: (sessionId: string) => Promise<void>;
  setConfigOption: (
    sessionId: string,
    configId: string,
    value: string | boolean,
  ) => Promise<AcpConfigOption[]>;
  setMode: (sessionId: string, modeId: string) => Promise<void>;
  setModel: (sessionId: string, modelId: string) => Promise<void>;
  permissionRespond: (requestId: string, optionId: string | null) => Promise<void>;
  reviewRevert: (sessionId: string, path: string) => Promise<"reverted" | "conflict">;
  /** Files the core still holds a revert snapshot for (current turn). */
  reviewChanges: (sessionId: string) => Promise<ChangedFile[]>;
  /** Drops the core's revert snapshot of one file, or of all (`null`). */
  reviewAccept: (sessionId: string, path: string | null) => Promise<void>;
  shutdown: () => Promise<void>;
}

export const tauriAgentIpc: AgentIpc = {
  subscribe: (onEvent) => {
    const channel = new Channel<AgentEvent>();
    channel.onmessage = onEvent;
    return invoke<void>("agents_subscribe", { onEvent: channel });
  },
  list: () => invoke<AgentInfo[]>("agents_list"),
  install: (agentId) => invoke<void>("agent_install", { agentId }),
  authenticate: (agentId, methodId) => invoke<void>("agent_authenticate", { agentId, methodId }),
  authTerminal: (agentId, methodId) => invoke<void>("agent_auth_terminal", { agentId, methodId }),
  sessionNew: (agentId, cwd) => invoke<SessionSetup>("agent_session_new", { agentId, cwd }),
  sessionLoad: (agentId, sessionId, cwd) =>
    invoke<SessionSetup>("agent_session_load", { agentId, sessionId, cwd }),
  sessionResume: (agentId, sessionId, cwd) =>
    invoke<SessionSetup>("agent_session_resume", { agentId, sessionId, cwd }),
  sessionClose: (sessionId) => invoke<void>("agent_session_close", { sessionId }),
  sessionsList: (agentId, cwd) =>
    invoke<AgentSessionInfo[]>("agent_sessions_list", { agentId, cwd }),
  sessionArchive: (agentId, sessionId, cwd, archived) =>
    invoke<void>("agent_session_archive", { agentId, sessionId, cwd, archived }),
  sessionDelete: (agentId, sessionId, cwd) =>
    invoke<void>("agent_session_delete", { agentId, sessionId, cwd }),
  sessionPin: (agentId, sessionId, cwd, pinned) =>
    invoke<void>("agent_session_pin", { agentId, sessionId, cwd, pinned }),
  sessionRename: (agentId, sessionId, cwd, title) =>
    invoke<void>("agent_session_rename", { agentId, sessionId, cwd, title }),
  prompt: (sessionId, blocks) => invoke<void>("agent_prompt", { sessionId, blocks }),
  cancel: (sessionId) => invoke<void>("agent_cancel", { sessionId }),
  setConfigOption: (sessionId, configId, value) =>
    invoke<AcpConfigOption[]>("agent_set_config_option", { sessionId, configId, value }),
  setMode: (sessionId, modeId) => invoke<void>("agent_set_mode", { sessionId, modeId }),
  setModel: (sessionId, modelId) => invoke<void>("agent_set_model", { sessionId, modelId }),
  permissionRespond: (requestId, optionId) =>
    invoke<void>("agent_permission_respond", { requestId, optionId }),
  reviewRevert: (sessionId, path) =>
    invoke<"reverted" | "conflict">("agent_review_revert", { sessionId, path }),
  reviewChanges: (sessionId) => invoke<ChangedFile[]>("agent_review_changes", { sessionId }),
  reviewAccept: (sessionId, path) => invoke<void>("agent_review_accept", { sessionId, path }),
  shutdown: () => invoke<void>("agents_shutdown"),
};

/** Rust prefixes ACP `-32000` errors with this (`AgentError::ipc_message`). */
export const AUTH_REQUIRED_PREFIX = "auth_required:";

export function errorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return String(err);
}

/** True when a command failed because the agent needs a sign-in. */
export function isAuthRequired(err: unknown): boolean {
  return errorMessage(err).startsWith(AUTH_REQUIRED_PREFIX);
}

/** The error text without the auth prefix. */
export function stripAuthPrefix(message: string): string {
  return message.startsWith(AUTH_REQUIRED_PREFIX)
    ? message.slice(AUTH_REQUIRED_PREFIX.length).trimStart()
    : message;
}

/** A file the agent changed in the current turn (mirror of Rust's `review::ChangedFile`). */
export interface ChangedFile {
  path: string;
  /** The file did not exist before the turn ("Revert" deletes it). */
  created: boolean;
}
