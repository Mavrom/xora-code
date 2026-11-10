// "Edit and retry": a new chat that continues from an earlier user message, next to the
// original (which is never changed). Pure decisions; the store runs them (`branchSession`).
//
// - fork:    the adapter copies the conversation up to the agent message before the edited
//            one (`session/fork`, see `src-tauri/src/agents/fork.rs`);
// - summary: a new session; the composer gets the transcript up to that message as text;
// - new:     the first message was edited, so there is nothing to keep.
// Files are never restored: when a later turn changed some, the new chat says so.

import type { Control, SessionControls } from "./controls";
import type { ControlChange } from "./defaults";
import type { ChatItem, SessionView } from "./reducer";
import type { AcpAgentCapabilities, AcpContentBlock } from "./types";
import { t } from "@/shared/i18n";

export type BranchVia = "fork" | "summary" | "new";

export interface BranchPlan {
  /** Index of the edited user message in `items`. */
  index: number;
  /** Its content, for the composer. */
  blocks: AcpContentBlock[];
  /** No user message before it: the branch keeps nothing. */
  first: boolean;
  /** The agent message to fork right after (the last one of the turn before), if known. */
  forkAfter: string | null;
  /** A later item edited, deleted or moved files: they stay as they are. */
  filesChanged: boolean;
}

/** Whether "Edit and retry" is offered: nothing running, loading or waiting on the user. */
export const canBranch = (view: SessionView): boolean =>
  view.turn === "idle" && !view.loading && view.permissions.length === 0;

/**
 * The id of the last agent message between the user message at `index` and the one
 * before it. Null when that turn has none with an id (older sessions, agents that send
 * no ids); an earlier turn's id would drop a whole turn, so it is never used.
 */
export function forkPoint(items: readonly ChatItem[], index: number): string | null {
  for (let i = index - 1; i >= 0; i--) {
    const item = items[i];
    if (item.kind === "user") return null;
    if (item.kind === "agent" && item.messageId) return item.messageId;
  }
  return null;
}

const FILE_KINDS = new Set(["edit", "delete", "move"]);

/** Whether a tool call at or after `index` changed files (not counting failed ones). */
export function filesChangedFrom(items: readonly ChatItem[], index: number): boolean {
  return items
    .slice(index)
    .some(
      (item) =>
        item.kind === "tool" &&
        item.call.status !== "failed" &&
        ((item.call.kind !== undefined && FILE_KINDS.has(item.call.kind)) ||
          (item.call.content ?? []).some((c) => c.type === "diff")),
    );
}

/** What branching from the user message `userItemId` involves, or null when it is not one. */
export function planBranch(items: readonly ChatItem[], userItemId: string): BranchPlan | null {
  const index = items.findIndex((i) => i.kind === "user" && i.id === userItemId);
  if (index < 0) return null;
  const item = items[index] as Extract<ChatItem, { kind: "user" }>;
  return {
    index,
    blocks: item.blocks,
    first: !items.slice(0, index).some((i) => i.kind === "user"),
    forkAfter: forkPoint(items, index),
    filesChanged: filesChangedFrom(items, index),
  };
}

/** How to branch: a real fork needs a cut point and an agent that forks. */
export function branchVia(plan: BranchPlan, capabilities: AcpAgentCapabilities): BranchVia {
  if (plan.first) return "new";
  return plan.forkAfter && capabilities.sessionCapabilities?.fork ? "fork" : "summary";
}

export const FILES_NOT_REVERTED = (): string =>
  t("Files changed after this message are not reverted.");
export const STARTED_FROM_SUMMARY = (): string =>
  t("Started from a summary of the conversation: this agent cannot branch it directly.");

/**
 * The new chat's first items: for a fork, the conversation it kept (as shown in the
 * original); then a quiet line for the summary fallback and for files left as they are.
 */
export function branchItems(
  source: SessionView,
  plan: BranchPlan,
  via: BranchVia,
): { items: ChatItem[]; nextId: number } {
  const items: ChatItem[] = via === "fork" ? source.items.slice(0, plan.index) : [];
  let nextId = via === "fork" ? source.nextId : 1;
  const note = (title: string) => {
    items.push({ kind: "notice", id: `notice-${nextId++}`, severity: "info", title });
  };
  if (via === "summary") note(STARTED_FROM_SUMMARY());
  if (plan.filesChanged) note(FILES_NOT_REVERTED());
  return { items, nextId };
}

const SLOTS = ["model", "mode", "effort"] as const;

function carry(from: Control | undefined, to: Control | undefined): ControlChange | null {
  if (!from || !to || from.key !== to.key || !("options" in from) || !("options" in to)) {
    return null;
  }
  if (from.current === to.current || !to.options.some((o) => o.value === from.current)) {
    return null;
  }
  return { key: to.key, via: to.via, value: from.current };
}

/**
 * Changes that give the new session the original's model, mode and effort (where it
 * offers the same value). With `skipModel`, the model is left out: it goes first, and
 * the effort options are planned again on what it leaves.
 */
export function inheritedControls(
  from: SessionControls,
  to: SessionControls,
  opts: { skipModel?: boolean } = {},
): ControlChange[] {
  return SLOTS.filter((slot) => !(opts.skipModel && slot === "model")).flatMap((slot) => {
    const change = carry(from[slot], to[slot]);
    return change ? [change] : [];
  });
}
