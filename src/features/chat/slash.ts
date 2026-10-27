// Slash command popover logic: when the composer starts with "/", list the session's agent
// commands plus Xora's own (which never reach the agent), fuzzy-ranked by the typed name.
import { fuzzyMatch } from "@/features/commands/fuzzy";
import type { AcpCommand } from "@/features/agents/types";
import { t } from "@/shared/i18n";

export type SlashGroup = "agent" | "xora";

export interface SlashItem {
  /** Stable key: group + name. */
  id: string;
  group: SlashGroup;
  /** Command name without the leading slash. */
  name: string;
  description: string;
  /** Argument hint shown after picking the command (agent commands only). */
  hint: string | null;
  /** Indices into `name` matched by the query, for highlighting. */
  positions: number[];
}

/** Xora-local commands; handled in the UI, never sent to the agent. */
export const XORA_COMMANDS = [
  { name: "new", description: t("Start a new chat") },
  { name: "clear", description: t("Close the chat, back to a blank page") },
] as const;

export type XoraCommandName = (typeof XORA_COMMANDS)[number]["name"];

/**
 * The command name being typed, or null when the popover should stay closed: the text
 * must start with "/" and the caret must still be inside the first word.
 */
export function slashQuery(value: string, caret: number): string | null {
  if (!value.startsWith("/")) return null;
  const end = value.search(/\s/);
  const wordEnd = end === -1 ? value.length : end;
  if (caret < 1 || caret > wordEnd) return null;
  return value.slice(1, wordEnd);
}

/** Ranked popover rows: agent commands first, then Xora's, each group by match score. */
export function filterSlash(commands: AcpCommand[], query: string): SlashItem[] {
  const rank = (
    group: SlashGroup,
    list: readonly { name: string; description: string; input?: { hint: string } | null }[],
  ) =>
    list
      .map((command, order) => {
        const match = fuzzyMatch(query, command.name);
        return match && { command, order, match };
      })
      .filter((row) => row !== null)
      .sort((a, b) => b.match.score - a.match.score || a.order - b.order)
      .map<SlashItem>(({ command, match }) => ({
        id: `${group}:${command.name}`,
        group,
        name: command.name,
        description: command.description,
        hint: command.input?.hint ?? null,
        positions: match.positions,
      }));

  return [...rank("agent", commands), ...rank("xora", XORA_COMMANDS)];
}

/** DOM id of a popover row, shared by the list and the textarea's aria-activedescendant. */
export const slashOptionId = (listId: string, index: number) => `${listId}-${index}`;

/** Composer text after picking `name`: the command plus a space, keeping typed arguments. */
export function applySlash(value: string, name: string): string {
  const end = value.search(/\s/);
  const rest = end === -1 ? "" : value.slice(end).trimStart();
  return `/${name} ${rest}`;
}

/** The Xora command a submitted text invokes ("/new", "/clear"), or null. */
export function xoraCommandOf(text: string): XoraCommandName | null {
  const match = /^\/(\S+)\s*$/.exec(text.trim());
  if (!match) return null;
  return XORA_COMMANDS.find((c) => c.name === match[1])?.name ?? null;
}
