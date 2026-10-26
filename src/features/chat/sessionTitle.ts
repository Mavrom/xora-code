import type { SessionView } from "@/features/agents/reducer";
import type { AcpContentBlock } from "@/features/agents/types";

/** Longest title shown before it is cut at a word boundary. */
export const TITLE_MAX = 40;

/**
 * Text as a title: its first sentence or line, whitespace collapsed, cut at a word
 * boundary past `max` characters ("bu tarz bir görsel üretmeni istiyorum…").
 */
export function shortTitle(text: string, max = TITLE_MAX): string {
  const first = (text.trim().split(/(?<=[.!?])\s|\n/)[0] ?? "").replace(/\s+/g, " ").trim();
  if (first.length <= max) return first;
  const cut = first.slice(0, max + 1);
  const space = cut.lastIndexOf(" ");
  const head = space > max / 2 ? cut.slice(0, space) : first.slice(0, max);
  return `${head.replace(/[\s,;:.-]+$/, "")}…`;
}

/** The first thing the user wrote in the conversation, or null. */
function firstPrompt(session: SessionView): string | null {
  for (const item of session.items) {
    if (item.kind !== "user") continue;
    const text = item.blocks
      .flatMap((b: AcpContentBlock) => (b.type === "text" ? [b.text] : []))
      .join(" ")
      .trim();
    if (text) return text;
  }
  return null;
}

/**
 * What a conversation is called: the title the agent gave it, else (until it does, or for
 * agents that never do) a short form of the first prompt. Some agents first echo the
 * prompt itself as the title; that is shortened the same way.
 */
export function sessionTitle(session: SessionView): string {
  if (session.title) return shortTitle(session.title);
  const prompt = firstPrompt(session);
  return prompt ? shortTitle(prompt) : "Yeni sohbet";
}

/** A conversation with messages (or one loading them) shows the transcript, not the hero. */
export const isDocked = (session: SessionView | null): session is SessionView =>
  session !== null && (session.items.length > 0 || session.loading);
