import { create } from "zustand";

interface WorkspaceState {
  root: string | null;
  setRoot: (root: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  root: null,
  setRoot: (root) => set({ root }),
}));
