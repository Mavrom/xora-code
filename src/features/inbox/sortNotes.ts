import type { Note } from "@/shared/lib/ipc";

/** 0 = pinned, 1 = open, 2 = done. A done note always sinks, pinned or not. */
const rank = (n: Note) => (n.done ? 2 : n.pinned ? 0 : 1);

/**
 * Display order: pinned first, then open notes newest first, done notes last
 * (most recently completed first). Returns a new array.
 */
export function sortNotes(notes: readonly Note[]): Note[] {
  return [...notes].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    return a.done ? b.updatedAt - a.updatedAt : b.createdAt - a.createdAt;
  });
}

/** Number of notes still open; drives the activity bar badge. */
export const openCount = (notes: readonly Note[]) => notes.filter((n) => !n.done).length;
