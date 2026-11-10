// "Edit and retry" on a user message: the branched chat (see `features/agents/branch.ts`)
// and the draft its composer gets. Nothing is sent: the user edits and sends it.
import type { BranchResult } from "@/features/agents/store";
import { useAgentStore } from "@/features/agents/store";
import { draftFromBlocks, type Attachment } from "./attachments";
import { sessionTitle } from "./sessionTitle";
import { branchPrompt, transcriptMarkdown } from "./transcript";
import { t } from "@/shared/i18n";

export interface BranchDraft {
  text: string;
  attachments: Attachment[];
  /** Parts of the message that could not be put back (see `draftFromBlocks`). */
  dropped: number;
}

/**
 * The composer draft for a branched chat: the edited message, and for the summary
 * fallback the conversation before it as text above it.
 */
export function branchDraft(
  result: Pick<BranchResult, "via" | "blocks" | "kept">,
  meta: { title: string; agent: string; date: Date },
): BranchDraft {
  const draft = draftFromBlocks(result.blocks);
  if (result.via !== "summary") return draft;
  const markdown = transcriptMarkdown(meta.title, result.kept, {
    agent: meta.agent,
    date: meta.date,
  });
  return { ...draft, text: branchPrompt(markdown, draft.text) };
}

/** The branched chat's name: it marks where it came from (once, for a branch of a branch). */
export function branchTitle(title: string): string {
  const prefix = t("Branch: {title}", { title: "" });
  return title.startsWith(prefix) ? title : t("Branch: {title}", { title });
}

/** Opens the branched chat for the user message `userItemId` and returns its draft. */
export async function editAndRetry(sessionId: string, userItemId: string): Promise<BranchDraft> {
  const state = useAgentStore.getState();
  const source = state.sessions[sessionId];
  if (!source) throw new Error(`unknown session ${sessionId}`);
  const title = sessionTitle(source);
  const result = await state.branchSession(sessionId, userItemId, { title: branchTitle(title) });
  const agent = state.agents[source.agentId]?.displayName ?? source.agentId;
  return branchDraft(result, { title, agent, date: new Date() });
}
