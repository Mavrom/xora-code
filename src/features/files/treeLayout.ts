import { basename } from "@/shared/lib/path";
import type { TreeRow } from "./treeModel";

/** Geometry shared by the explorer tree and its rows. */
const ROW_PADDING = 8;
const INDENT = 14;
/** Width of the leading chevron / file icon slot. */
export const SLOT = 14;
/** Slot plus the gap before the name, so status text lines up with names. */
export const NAME_OFFSET = SLOT + 6;
/** Every tree line is exactly this tall, which is what makes windowing cheap. */
export const ROW_HEIGHT = 24;

/** Build output and dependency folders: dimmed (with everything inside), never hidden. */
const NOISY = new Set(["node_modules", "dist", "target", ".claude"]);

export const indentOf = (depth: number) => ROW_PADDING + depth * INDENT;

/** Rows inside (or naming) a noisy folder such as node_modules are drawn dimmed. */
export function isDimmed(row: TreeRow): boolean {
  if (row.ancestors.some((a) => NOISY.has(basename(a)))) return true;
  return row.kind === "node" && NOISY.has(row.node.entry.name);
}
