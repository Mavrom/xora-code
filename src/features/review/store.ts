// The Review panel: whether it fills the right-hand card, and which file it shows.
import { useMemo } from "react";
import { create } from "zustand";
import { selectActiveSession, useAgentStore } from "@/features/agents/store";
import type { ReviewChange } from "@/features/agents/reducer";
import { useChangesStore } from "@/features/git/changesStore";
import { reviewSections, selectionForFile, type ReviewSelection } from "./reviewList";

/** Focus target when the panel is opened from the keyboard (Ctrl+Shift+G). */
export const REVIEW_PANEL_ID = "review-panel";

interface ReviewState {
  open: boolean;
  selected: ReviewSelection | null;
  /** Opens the panel, on `selected` when given. */
  show: (selected?: ReviewSelection | null) => void;
  close: () => void;
  toggle: () => void;
  select: (selected: ReviewSelection) => void;
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  open: false,
  selected: null,
  show: (selected) => set({ open: true, ...(selected ? { selected } : {}) }),
  close: () => set({ open: false }),
  toggle: () => set({ open: !get().open }),
  select: (selected) => set({ selected }),
}));

const NO_CHANGES: ReviewChange[] = [];

/** The active chat's changes since the last Accept (empty while a turn runs, as before). */
function useTurnChanges(): ReviewChange[] {
  return useAgentStore((s) => {
    const session = selectActiveSession(s);
    return session && session.turn === "idle" ? session.changes : NO_CHANGES;
  });
}

/** What the panel lists, from the agent store and the git status store. */
export function useReviewSections() {
  const turn = useTurnChanges();
  const status = useChangesStore((s) => s.status);
  return useMemo(() => reviewSections(turn, status), [turn, status]);
}

/** Whether the panel lists `file` (absolute path), so a diff card can open it there. */
export function useReviewable(file: string): boolean {
  const sections = useReviewSections();
  const root = useChangesStore((s) => s.status?.root ?? null);
  return useMemo(() => selectionForFile(sections, root, file) !== null, [sections, root, file]);
}

/** Opens the panel and focuses it (Ctrl+Shift+G, the palette). */
export function showReview() {
  useReviewStore.getState().show();
  requestAnimationFrame(() => document.getElementById(REVIEW_PANEL_ID)?.focus());
}

/**
 * Opens the panel on `file` (absolute path) when it lists that file; returns whether it did.
 * The transcript's diff cards use it instead of opening a diff tab.
 */
export function reviewFile(file: string): boolean {
  const session = selectActiveSession(useAgentStore.getState());
  const status = useChangesStore.getState().status;
  const sections = reviewSections(session?.turn === "idle" ? session.changes : [], status);
  const selected = selectionForFile(sections, status?.root ?? null, file);
  if (!selected) return false;
  useReviewStore.getState().show(selected);
  return true;
}
