// Line diff for tool-call previews (Myers' O(ND) algorithm on lines, with common prefix and
// suffix trimmed first). Pure and synchronous: previews are small; huge rewrites fall back
// to "everything removed, everything added" instead of stalling the UI.

export interface DiffLine {
  type: "context" | "add" | "del";
  text: string;
  /** 1-based line number in the old text (null for additions). */
  oldNo: number | null;
  /** 1-based line number in the new text (null for deletions). */
  newNo: number | null;
}

export interface DiffHunk {
  oldStart: number;
  newStart: number;
  lines: DiffLine[];
}

/** Upper bound on edit distance before giving up on a minimal diff (memory is O(D²)). */
const MAX_EDIT_DISTANCE = 1500;

function toLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  // A trailing newline ends the last line rather than starting an empty one.
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

type Op = "context" | "add" | "del";

/** Minimal edit script between `a` and `b`, or null when it exceeds `maxD` edits. */
function myers(a: string[], b: string[], maxD: number): Op[] | null {
  const n = a.length;
  const m = b.length;
  const max = Math.min(n + m, maxD);
  const offset = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace: Int32Array[] = [];

  for (let d = 0; d <= max; d++) {
    trace.push(v.slice(offset - d - 1, offset + d + 2));
    for (let k = -d; k <= d; k += 2) {
      let x =
        k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])
          ? v[offset + k + 1]
          : v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) return backtrack(trace, n, m);
    }
  }
  return null;
}

function backtrack(trace: Int32Array[], n: number, m: number): Op[] {
  const ops: Op[] = [];
  let x = n;
  let y = m;
  for (let d = trace.length - 1; d >= 0; d--) {
    const snap = trace[d];
    // Snapshot d holds k in [-d-1, d+1] at index k + d + 1.
    const at = (k: number) => snap[k + d + 1];
    const k = x - y;
    const prevK = k === -d || (k !== d && at(k - 1) < at(k + 1)) ? k + 1 : k - 1;
    const prevX = at(prevK);
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      ops.push("context");
      x--;
      y--;
    }
    if (d > 0) {
      if (x === prevX) {
        ops.push("add");
        y--;
      } else {
        ops.push("del");
        x--;
      }
    }
  }
  return ops.reverse();
}

/** Full line-by-line diff of two texts. A null/undefined `oldText` means a new file. */
export function diffLines(oldText: string | null | undefined, newText: string): DiffLine[] {
  const a = toLines(oldText ?? "");
  const b = toLines(newText);

  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const ops: Op[] = [
    ...new Array<Op>(start).fill("context"),
    ...(myers(midA, midB, MAX_EDIT_DISTANCE) ?? [
      ...new Array<Op>(midA.length).fill("del"),
      ...new Array<Op>(midB.length).fill("add"),
    ]),
    ...new Array<Op>(a.length - endA).fill("context"),
  ];

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  for (const op of ops) {
    if (op === "context") {
      out.push({ type: "context", text: a[i], oldNo: i + 1, newNo: j + 1 });
      i++;
      j++;
    } else if (op === "del") {
      out.push({ type: "del", text: a[i], oldNo: i + 1, newNo: null });
      i++;
    } else {
      out.push({ type: "add", text: b[j], oldNo: null, newNo: j + 1 });
      j++;
    }
  }
  return out;
}

/** Groups changed lines into hunks with `context` unchanged lines around each change. */
export function toHunks(lines: DiffLine[], context = 3): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let current: DiffLine[] | null = null;
  let lastChange = -Infinity;

  for (let index = 0; index < lines.length; index++) {
    if (lines[index].type === "context") continue;
    const from = Math.max(0, index - context);
    if (current && from <= lastChange + context + 1) {
      // Close enough to the previous change: extend the open hunk through this line.
      for (let k = lastChange + 1; k <= index; k++) current.push(lines[k]);
    } else {
      if (current) closeHunk(current, lines, lastChange, context);
      current = lines.slice(from, index + 1);
      hunks.push({ oldStart: 0, newStart: 0, lines: current });
    }
    lastChange = index;
  }
  if (current) closeHunk(current, lines, lastChange, context);

  for (const hunk of hunks) {
    const first = hunk.lines[0];
    hunk.oldStart = first.oldNo ?? firstNumber(hunk.lines, "oldNo");
    hunk.newStart = first.newNo ?? firstNumber(hunk.lines, "newNo");
  }
  return hunks;
}

function closeHunk(hunk: DiffLine[], lines: DiffLine[], lastChange: number, context: number) {
  for (let k = lastChange + 1; k <= Math.min(lines.length - 1, lastChange + context); k++) {
    hunk.push(lines[k]);
  }
}

function firstNumber(lines: DiffLine[], key: "oldNo" | "newNo"): number {
  for (const line of lines) if (line[key] !== null) return line[key];
  return 0;
}

/** The first `maxRows` rows of `hunks` (whole hunks, the last one possibly cut short). */
export function limitHunks(hunks: DiffHunk[], maxRows: number): DiffHunk[] {
  const out: DiffHunk[] = [];
  let budget = maxRows;
  for (const hunk of hunks) {
    if (budget <= 0) break;
    const lines = hunk.lines.slice(0, budget);
    budget -= lines.length;
    out.push({ ...hunk, lines });
  }
  return out;
}

/** Added and removed line counts, for "+12 −3" badges. */
export function diffStats(lines: DiffLine[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.type === "add") added++;
    else if (line.type === "del") removed++;
  }
  return { added, removed };
}
