// Reads git's unified diff of one file into the hunk shape the chat's diff table renders.
import type { DiffHunk, DiffLine } from "@/features/chat/diff";

export interface ParsedDiff {
  hunks: DiffHunk[];
  /** Git said "Binary files … differ": there are no lines to show. */
  binary: boolean;
}

const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

export function parseUnifiedDiff(text: string): ParsedDiff {
  const hunks: DiffHunk[] = [];
  let binary = false;
  let current: DiffLine[] | null = null;
  // Lines left in the open hunk on each side; the hunk ends when both reach zero, so a
  // removed line that reads "--- x" is never mistaken for a file header.
  let oldLeft = 0;
  let newLeft = 0;
  let oldNo = 0;
  let newNo = 0;

  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    if (current && (oldLeft > 0 || newLeft > 0)) {
      const sign = line[0];
      const body = line.slice(1);
      if (sign === "+") {
        current.push({ type: "add", text: body, oldNo: null, newNo: newNo++ });
        newLeft--;
      } else if (sign === "-") {
        current.push({ type: "del", text: body, oldNo: oldNo++, newNo: null });
        oldLeft--;
      } else if (sign === " " || line === "") {
        current.push({ type: "context", text: body, oldNo: oldNo++, newNo: newNo++ });
        oldLeft--;
        newLeft--;
      }
      // "\ No newline at end of file" and anything unexpected: skipped.
      continue;
    }
    const head = HUNK.exec(line);
    if (head) {
      oldNo = Number(head[1]);
      newNo = Number(head[3]);
      oldLeft = head[2] === undefined ? 1 : Number(head[2]);
      newLeft = head[4] === undefined ? 1 : Number(head[4]);
      current = [];
      hunks.push({ oldStart: oldNo, newStart: newNo, lines: current });
    } else if (line.startsWith("Binary files ") && line.endsWith(" differ")) {
      binary = true;
    }
  }
  return { hunks, binary };
}
