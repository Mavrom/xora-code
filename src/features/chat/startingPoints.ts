// What a new chat offers under its composer, for a project with no conversation yet: the top
// Inbox note and, while slots are left, a few starter prompts. Pure.
import { sameProject, type SessionListEntry } from "@/features/agents/sessionList";
import { sortNotes } from "@/features/inbox/sortNotes";
import type { Note } from "@/shared/lib/ipc";
import { msg } from "@/shared/i18n";

/** At most this many starting points are shown. */
export const MAX_STARTING_POINTS = 3;

/** A prompt for an open folder: a short label, and the text it puts in the composer. */
export interface StarterPrompt {
  label: string;
  text: string;
}

/** Message ids (translate with `t()` where shown). The text is left open to edit first. */
export const STARTER_PROMPTS: readonly StarterPrompt[] = [
  {
    label: msg("Explain this project"),
    text: msg(
      "Explain how this project is structured: the main parts, how they fit together, and where to start reading.",
    ),
  },
  {
    label: msg("Find and fix a bug"),
    text: msg("Find a likely bug in this project, explain why it is one, and fix it."),
  },
  {
    label: msg("Write tests for a file"),
    text: msg("Write tests for this file: "),
  },
];

export type StartingPoint =
  { kind: "note"; note: Note } | { kind: "prompt"; prompt: StarterPrompt };

export interface StartingPointsInput {
  /** Conversations newest first, without the untouched ones (`flatSessions(visibleGroups(…))`). */
  sessions: readonly SessionListEntry[];
  /** The open project's folders (the repository and its worktrees); empty when none is open. */
  projectPaths: readonly string[];
  /** The chat this screen belongs to; it does not count as the project's history. */
  currentSessionId: string | null;
  notes: readonly Note[];
  prompts?: readonly StarterPrompt[];
}

/**
 * Which starting points to show, in order: the Inbox, then starter prompts. Only for a
 * project with no conversation yet (archived ones count): a returning user gets a clean hero,
 * the sidebar already lists their chats.
 */
export function startingPoints({
  sessions,
  projectPaths,
  currentSessionId,
  notes,
  prompts = STARTER_PROMPTS,
}: StartingPointsInput): StartingPoint[] {
  const hasHistory = sessions.some(
    (e) => e.sessionId !== currentSessionId && projectPaths.some((p) => sameProject(e.cwd, p)),
  );
  if (hasHistory) return [];

  const out: StartingPoint[] = [];

  const note = sortNotes(notes).find((n) => !n.done && n.text.trim() !== "");
  if (note) out.push({ kind: "note", note });

  // Starter prompts only fill what is left, and only make sense with a folder to work in.
  if (projectPaths.length > 0) {
    for (const prompt of prompts) {
      if (out.length >= MAX_STARTING_POINTS) break;
      out.push({ kind: "prompt", prompt });
    }
  }
  return out.slice(0, MAX_STARTING_POINTS);
}

/** First non-empty line of a note, for a one-line label. */
export function noteLine(text: string): string {
  return (
    text
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}
