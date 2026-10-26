import type { SessionView } from "@/features/agents/reducer";
import type { AcpContentBlock } from "@/features/agents/types";

/** What a conversation is called: the agent's title, else the first line the user wrote. */
export function sessionTitle(session: SessionView): string {
  if (session.title) return session.title;
  for (const item of session.items) {
    if (item.kind !== "user") continue;
    const text = item.blocks
      .flatMap((b: AcpContentBlock) => (b.type === "text" ? [b.text] : []))
      .join(" ")
      .trim();
    if (text) return text.split("\n")[0];
  }
  return "Yeni sohbet";
}

/** A conversation with messages (or one loading them) shows the transcript, not the hero. */
export const isDocked = (session: SessionView | null): session is SessionView =>
  session !== null && (session.items.length > 0 || session.loading);
