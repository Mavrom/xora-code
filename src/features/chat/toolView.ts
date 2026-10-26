// Pure helpers behind ToolCallCard and PermissionPrompt: pick out diffs, terminals and text
// from a tool call's content, trim terminal output, and map keyboard shortcuts to options.
import type {
  AcpPermissionOption,
  AcpToolCall,
  AcpToolCallUpdate,
  AcpToolContent,
} from "@/features/agents/types";
import { imageMime } from "./attachments";

export type DiffContent = Extract<AcpToolContent, { type: "diff" }>;

/** Diff entries of a tool call (or a permission request's tool call), in order. */
export function toolDiffs(call: Pick<AcpToolCallUpdate, "content">): DiffContent[] {
  return (call.content ?? []).filter((c): c is DiffContent => c.type === "diff");
}

/** Terminal ids attached to a tool call. */
export function toolTerminals(call: Pick<AcpToolCall, "content">): string[] {
  return (call.content ?? []).flatMap((c) => (c.type === "terminal" ? [c.terminalId] : []));
}

/** Plain text carried by `content` blocks (text and embedded resources), joined. */
export function toolText(call: Pick<AcpToolCall, "content">): string {
  return (call.content ?? [])
    .flatMap((c) => {
      if (c.type !== "content") return [];
      const block = c.content;
      if (block.type === "text") return [block.text];
      if (block.type === "resource" && block.resource.text) return [block.resource.text];
      return [];
    })
    .join("\n\n")
    .trim();
}

/** A picture a tool call produced or looked at: inline bytes, or a file to read. */
export type ToolImage =
  | { key: string; kind: "data"; mimeType: string; data: string; path: string | null }
  | { key: string; kind: "file"; path: string };

/** `file:///C:/a%20b/c.png` or a plain path -> `C:/a b/c.png`; null for other schemes. */
export function localPath(uri: string): string | null {
  if (/^file:/i.test(uri)) {
    const path = decodeURIComponent(uri.replace(/^file:\/\//i, ""));
    return /^\/[a-z]:/i.test(path) ? path.slice(1) : path;
  }
  return /^[a-z][a-z0-9+.-]+:\/\//i.test(uri) ? null : uri;
}

/**
 * Pictures in a tool call's content: image blocks (e.g. Codex's image generation) and
 * links to image files (e.g. "View Image"), once per file.
 */
export function toolImages(call: Pick<AcpToolCall, "content">): ToolImage[] {
  const seen = new Set<string>();
  const out: ToolImage[] = [];
  const add = (image: ToolImage) => {
    const id = (image.path ?? image.key).replace(/\\/g, "/").toLowerCase();
    if (seen.has(id)) return;
    seen.add(id);
    out.push(image);
  };
  (call.content ?? []).forEach((c, i) => {
    if (c.type !== "content") return;
    const block = c.content;
    if (block.type === "image") {
      const path = block.uri ? localPath(block.uri) : null;
      if (block.data)
        add({ key: `img-${i}`, kind: "data", mimeType: block.mimeType, data: block.data, path });
      else if (path) add({ key: `img-${i}`, kind: "file", path });
    } else if (block.type === "resource_link") {
      const path = localPath(block.uri);
      if (path && (block.mimeType?.startsWith("image/") || imageMime(path))) {
        add({ key: `link-${i}`, kind: "file", path });
      }
    }
  });
  return out;
}

/** Whether a card should open by itself: edits show their diff, failures show the error. */
export function opensByDefault(call: AcpToolCall): boolean {
  return (call.kind === "edit" && toolDiffs(call).length > 0) || call.status === "failed";
}

export interface TerminalPreview {
  lines: string[];
  /** Lines left out of the preview (from the start: the tail is the interesting part). */
  hidden: number;
}

/** The last `max` lines of terminal output; trailing blank lines do not count. */
export function terminalPreview(output: string, max = 12, expanded = false): TerminalPreview {
  const lines = output.replace(/\r\n?/g, "\n").replace(/\n+$/, "").split("\n");
  if (lines.length === 1 && lines[0] === "") return { lines: [], hidden: 0 };
  if (expanded || lines.length <= max) return { lines, hidden: 0 };
  return { lines: lines.slice(-max), hidden: lines.length - max };
}

/** Last path segment for compact labels ("src/lib.rs" -> "lib.rs"). */
export function fileName(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

/** Whether an agent status deserves a card (ready and not-yet-started agents stay quiet). */
export function needsStatusCard(status: { state: string }): boolean {
  return status.state !== "ready" && status.state !== "stopped";
}

/** Option Enter picks in a permission prompt: the first one-time allow, else any allow. */
export function defaultAllow(options: AcpPermissionOption[]): AcpPermissionOption | null {
  return (
    options.find((o) => o.kind === "allow_once") ??
    options.find((o) => o.kind === "allow_always") ??
    null
  );
}

/** Option Esc picks: a one-time reject when offered, else any reject. */
export function defaultReject(options: AcpPermissionOption[]): AcpPermissionOption | null {
  return (
    options.find((o) => o.kind === "reject_once") ??
    options.find((o) => o.kind === "reject_always") ??
    null
  );
}

const PERMISSION_LABELS: Record<AcpPermissionOption["kind"], string> = {
  allow_once: "İzin ver",
  allow_always: "Hep izin ver",
  reject_once: "Reddet",
  reject_always: "Hep reddet",
};

/**
 * Turkish label for a permission option. Agents send English names; when two
 * options share a kind the agent's own wording is kept so they stay distinct.
 */
export function permissionLabel(
  option: AcpPermissionOption,
  options: AcpPermissionOption[],
): string {
  const sameKind = options.filter((o) => o.kind === option.kind).length;
  return sameKind > 1 ? option.name : (PERMISSION_LABELS[option.kind] ?? option.name);
}
