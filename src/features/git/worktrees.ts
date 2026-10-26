// Git worktrees for agent chats (Rust: `src-tauri/src/git`). A new chat can run in its own
// checkout on its own `xora/<name>` branch; this store remembers which checkout new chats
// use and keeps each repository's worktree list.
import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { projectKey } from "@/features/agents/sessionList";

export interface Worktree {
  path: string;
  /** Short branch name; null when detached. */
  branch: string | null;
  head: string;
  /** The repository's own checkout. */
  main: boolean;
}

export const worktreeIpc = {
  list: (repo: string) => invoke<Worktree[]>("git_worktrees", { repo }),
  create: (repo: string, name: string) => invoke<Worktree>("git_worktree_create", { repo, name }),
  merge: (repo: string, path: string, message: string) =>
    invoke<string>("git_worktree_merge", { repo, path, message }),
  remove: (repo: string, path: string, force: boolean) =>
    invoke<void>("git_worktree_remove", { repo, path, force }),
};

/** Turkish text for a `[code] …` error from the git commands. */
export function describeGitError(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  const code = /^\[([a-z_]+)\]/.exec(text)?.[1];
  switch (code) {
    case "no_git":
      return "Git bulunamadı. Worktree için Git'in kurulu olması gerekiyor.";
    case "dirty":
      return "Worktree'de kaydedilmemiş değişiklikler var.";
    case "unmerged":
      return "Worktree kaldırıldı ama branch'inde birleştirilmemiş commit'ler var; branch duruyor.";
    case "not_ff":
      return "Ana branch ilerlemiş; değişiklikler otomatik alınamadı. Önce birleştirmen gerekiyor.";
    default:
      return text.replace(/^\[[a-z_]+\]\s*/, "");
  }
}

/** Friendly names for new worktrees; git adds a number when one is taken. */
const NAMES = [
  "ankara",
  "izmir",
  "bursa",
  "mardin",
  "rize",
  "kars",
  "sinop",
  "datca",
  "assos",
  "kas",
  "urla",
  "artvin",
  "efes",
  "truva",
  "nemrut",
  "zeugma",
  "bodrum",
  "safranbolu",
  "amasra",
  "uzungol",
];

export const pickName = (random: () => number = Math.random) =>
  NAMES[Math.floor(random() * NAMES.length) % NAMES.length];

/** The folder name of a worktree path, as shown on the checkout chip. */
export const worktreeName = (path: string) =>
  path
    .replace(/[\\/]+$/, "")
    .split(/[\\/]/)
    .pop() ?? path;

/** The worktree (not the main checkout) a folder belongs to, if any. */
export function worktreeOf(list: readonly Worktree[], cwd: string): Worktree | null {
  const key = projectKey(cwd);
  return list.find((w) => !w.main && projectKey(w.path) === key) ?? null;
}

interface WorktreeState {
  /** Worktrees per repository (keyed by `projectKey` of the repo root). */
  byRepo: Record<string, Worktree[]>;
  /** Checkout new chats start in; null is the repository itself. */
  selected: string | null;
  load: (repo: string) => Promise<Worktree[]>;
  select: (path: string | null) => void;
  create: (repo: string) => Promise<Worktree>;
  merge: (repo: string, path: string, message: string) => Promise<string>;
  remove: (repo: string, path: string, force: boolean) => Promise<void>;
}

export const useWorktreeStore = create<WorktreeState>((set, get) => {
  const reload = async (repo: string) => {
    const list = await worktreeIpc.list(repo).catch(() => [] as Worktree[]);
    const selected = get().selected;
    set({
      byRepo: { ...get().byRepo, [projectKey(repo)]: list },
      // A selection that no longer exists (removed outside Xora) falls back to the repo.
      selected: selected && worktreeOf(list, selected) ? selected : null,
    });
    return list;
  };
  return {
    byRepo: {},
    selected: null,
    load: reload,
    select: (path) => set({ selected: path }),
    create: async (repo) => {
      const worktree = await worktreeIpc.create(repo, pickName());
      await reload(repo);
      set({ selected: worktree.path });
      return worktree;
    },
    merge: async (repo, path, message) => {
      const into = await worktreeIpc.merge(repo, path, message);
      if (get().selected === path) set({ selected: null });
      await reload(repo);
      return into;
    },
    remove: async (repo, path, force) => {
      try {
        await worktreeIpc.remove(repo, path, force);
      } finally {
        if (get().selected === path) set({ selected: null });
        await reload(repo);
      }
    },
  };
});

/** Worktrees of `repo` (empty until loaded or when it is not a git repository). */
export const selectWorktrees = (repo: string | null) => (s: WorktreeState) =>
  (repo && s.byRepo[projectKey(repo)]) || EMPTY;

const EMPTY: Worktree[] = [];
