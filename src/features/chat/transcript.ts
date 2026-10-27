// A conversation as Markdown, for "Sohbeti kopyala" / "Sohbeti dışa aktar": the messages
// in order, tool steps as one line each, thinking left out.
import type { ChatItem } from "@/features/agents/reducer";
import type { AcpContentBlock } from "@/features/agents/types";
import { localeOf, t } from "@/shared/i18n";

const STATUS: Record<string, string> = {
  completed: t("done"),
  failed: t("failed"),
  pending: t("pending"),
  in_progress: t("in progress"),
};

function userText(blocks: AcpContentBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === "text") return b.text;
      if (b.type === "image") return t("_[image]_");
      if (b.type === "resource_link") return t("_[file: {name}]_", { name: b.name || b.uri });
      return t("_[attachment: {uri}]_", { uri: b.resource.uri });
    })
    .join("\n\n")
    .trim();
}

/** Quotes each line, so a message keeps its own Markdown inside the quote. */
const quote = (text: string) =>
  text
    .split("\n")
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n");

export function transcriptMarkdown(
  title: string,
  items: readonly ChatItem[],
  meta: { agent: string; date: Date },
): string {
  const out: string[] = [
    `# ${title}`,
    `_${meta.agent} · ${meta.date.toLocaleString(localeOf())} · Xora Code_`,
  ];
  let tools: string[] = [];
  const flushTools = () => {
    if (tools.length) out.push(tools.join("\n"));
    tools = [];
  };
  for (const item of items) {
    if (item.kind === "tool") {
      const status = STATUS[item.call.status ?? "pending"] ?? item.call.status;
      tools.push(`- \`${item.call.title.replace(/`/g, "'")}\` — ${status}`);
      continue;
    }
    flushTools();
    if (item.kind === "user") {
      const text = userText(item.blocks);
      if (text) out.push(`**Sen**\n\n${quote(text)}`);
    } else if (item.kind === "agent") {
      if (item.text.trim()) out.push(item.text.trim());
    } else if (item.kind === "plan") {
      out.push(
        item.entries
          .map((e) => `- [${e.status === "completed" ? "x" : " "}] ${e.content}`)
          .join("\n"),
      );
    } else if (item.kind === "notice") {
      out.push(`> **${item.title}**`);
    }
  }
  flushTools();
  return `${out.join("\n\n")}\n`;
}

/** A file name for the export: the title, made safe for every file system. */
export function transcriptFileName(title: string): string {
  const safe = [...title]
    // Control characters (below space) and what Windows refuses in a file name.
    .filter((ch) => ch >= " " && !'<>:"/\\|?*'.includes(ch))
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60)
    .replace(/[. ]+$/, "");
  return `${safe || "sohbet"}.md`;
}

/** Longest transcript put into a hand-off prompt; older parts are cut first. */
export const HANDOFF_MAX = 12_000;

/**
 * The first message for the agent that takes over a conversation: what happened so far
 * (its latest part when long), and what to do with it.
 */
export function handoffPrompt(fromAgent: string, markdown: string, max = HANDOFF_MAX): string {
  const body =
    markdown.length > max
      ? t("_(the start of the conversation was cut)_\n\n…{tail}", {
          tail: markdown.slice(markdown.length - max),
        })
      : markdown;
  return [
    t("I was working through this conversation with {fromAgent}; take it from here.", {
      fromAgent,
    }),
    t(
      "First sum up where things stand in two or three sentences, then suggest the next step from where we left off.",
    ),
    "",
    "---",
    "",
    body.trim(),
  ].join("\n");
}
