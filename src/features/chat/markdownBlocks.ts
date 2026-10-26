// Streaming markdown helpers: split a growing message into top-level blocks so finished
// blocks can be memoised and only the tail is re-parsed on every chunk.

/** Opening fence: up to three spaces, then three or more backticks or tildes. */
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
/** A list item marker at the start of a line (bullets or ordered). */
const LIST_ITEM = /^ {0,3}(?:[-*+]|\d{1,9}[.)])(?:\s|$)/;

/** True when `line` closes a fence opened with `marker` (same char, at least as long). */
function closesFence(line: string, marker: string): boolean {
  const match = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line);
  return match !== null && match[1][0] === marker[0] && match[1].length >= marker.length;
}

/**
 * Whether a line that follows a blank line still belongs to the current block: indented
 * continuations (list paragraphs, nested content) and further items of the same list stay
 * together, so a loose list renders as one list instead of many.
 */
function continuesBlock(block: string[], line: string): boolean {
  if (/^[ \t]/.test(line)) return true;
  return LIST_ITEM.test(block[0]) && LIST_ITEM.test(line);
}

/**
 * Splits markdown into top-level blocks at blank lines. Fenced code is never split, even
 * across blank lines; an unterminated fence runs to the end of the text.
 */
export function splitBlocks(text: string): string[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: string[] = [];
  let current: string[] = [];
  let fence: string | null = null;
  let sawBlank = false;

  const flush = () => {
    if (current.length > 0) blocks.push(current.join("\n"));
    current = [];
  };

  for (const line of lines) {
    if (fence !== null) {
      current.push(line);
      if (closesFence(line, fence)) fence = null;
      continue;
    }
    if (line.trim() === "") {
      if (current.length > 0) sawBlank = true;
      continue;
    }
    if (sawBlank) {
      sawBlank = false;
      if (continuesBlock(current, line)) current.push("");
      else flush();
    }
    const open = FENCE_OPEN.exec(line);
    if (open) fence = open[1];
    current.push(line);
  }
  flush();
  return blocks;
}

/** The fence marker left open at the end of `block`, or null when every fence is closed. */
export function openFence(block: string): string | null {
  let fence: string | null = null;
  for (const line of block.split("\n")) {
    if (fence !== null) {
      if (closesFence(line, fence)) fence = null;
      continue;
    }
    const open = FENCE_OPEN.exec(line);
    if (open) fence = open[1];
  }
  return fence;
}

/** Temporarily closes a fence that is still streaming, so the tail renders as code. */
export function closeOpenFence(block: string): string {
  const fence = openFence(block);
  return fence === null ? block : `${block}\n${fence}`;
}
