import { useEffect, useState } from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import { ChevronDown, FolderGit2, GitBranchPlus, GitMerge, Monitor, Trash2 } from "lucide-react";
import { projectKey } from "@/features/agents/sessionList";
import { useAgentStore } from "@/features/agents/store";
import {
  describeGitError,
  selectWorktrees,
  useWorktreeStore,
  worktreeName,
  worktreeOf,
} from "@/features/git/worktrees";
import { cn } from "@/shared/ui/cn";
import { ContextMenu } from "@/shared/ui/ContextMenu";
import { SEPARATOR, type MenuEntry } from "@/shared/ui/menuModel";

interface CheckoutChipProps {
  /** The open repository. */
  repo: string;
  /** Folder the current chat works in (a worktree path, or the repository). */
  cwd: string;
  /** Title of the current chat, for the commit that takes a worktree's work home. */
  chatTitle: string | null;
  onNotice: (text: string) => void;
}

/** A fresh chat in whichever checkout was just picked. */
const startNewChat = () => useAgentStore.getState().setActiveSession(null);

/**
 * Closes the open chats running in `path` before it goes away: their agent processes
 * keep the folder busy, and a chat in a deleted folder could not continue anyway.
 */
/**
 * Points new chats back at the repository before `path` goes away, so the warm chat that
 * follows a close does not reopen inside the worktree being removed.
 */
function leave(path: string) {
  const store = useWorktreeStore.getState();
  if (store.selected && projectKey(store.selected) === projectKey(path)) store.select(null);
}

async function closeChatsIn(path: string) {
  const store = useAgentStore.getState();
  const key = projectKey(path);
  const inside = Object.values(store.sessions).filter((v) => projectKey(v.cwd) === key);
  await Promise.all(inside.map((v) => store.closeSession(v.sessionId)));
}

/**
 * "Mevcut checkout ▾": where the agent works. The repository itself, or a worktree on its
 * own `xora/<name>` branch so the agent never touches your working tree. A worktree's
 * work is taken home (fast-forward into the main checkout's branch) or thrown away here.
 */
export function CheckoutChip({ repo, cwd, chatTitle, onNotice }: CheckoutChipProps) {
  const worktrees = useWorktreeStore(selectWorktrees(repo));
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const current = worktreeOf(worktrees, cwd);
  const main = worktrees.find((w) => w.main) ?? null;
  const store = useWorktreeStore.getState;

  useEffect(() => {
    void useWorktreeStore.getState().load(repo);
  }, [repo]);

  // Not a git repository: there is nothing to choose.
  if (!main) return null;

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    try {
      await job();
    } catch (err) {
      onNotice(describeGitError(err));
    } finally {
      setBusy(false);
    }
  };

  const choose = (path: string | null) => {
    store().select(path);
    if ((path ?? repo) !== cwd) startNewChat();
  };

  const createWorktree = () =>
    run(async () => {
      const wt = await store().create(repo);
      startNewChat();
      onNotice(`Yeni worktree: ${worktreeName(wt.path)} (${wt.branch ?? ""})`);
    });

  const mergeHome = (path: string, name: string) =>
    run(async () => {
      leave(path);
      await closeChatsIn(path);
      const into = await store().merge(repo, path, chatTitle ?? `xora: ${name}`);
      startNewChat();
      onNotice(`${name} değişiklikleri ${into} branch'ine alındı; worktree kaldırıldı.`);
    });

  const removeWorktree = (path: string, name: string) =>
    run(async () => {
      leave(path);
      await closeChatsIn(path);
      try {
        await store().remove(repo, path, false);
      } catch (err) {
        if (!String(err).startsWith("[dirty]")) throw err;
        const sure = await ask(
          `${name} worktree'sinde kaydedilmemiş değişiklikler var. Silinirse bunlar kaybolur.`,
          {
            title: "Worktree silinsin mi?",
            kind: "warning",
            okLabel: "Sil",
            cancelLabel: "Vazgeç",
          },
        );
        if (!sure) return;
        await store().remove(repo, path, true);
      }
      startNewChat();
      onNotice(`${name} worktree'si silindi.`);
    });

  const items: MenuEntry[] = [
    {
      label: "Mevcut checkout",
      icon: Monitor,
      hint: main.branch ?? undefined,
      checked: current === null,
      onSelect: () => choose(null),
    },
    ...worktrees
      .filter((w) => !w.main)
      .map((w) => ({
        label: worktreeName(w.path),
        icon: FolderGit2,
        hint: w.branch ?? undefined,
        checked: current?.path === w.path,
        onSelect: () => choose(w.path),
      })),
    SEPARATOR,
    { label: "Yeni worktree", icon: GitBranchPlus, onSelect: () => void createWorktree() },
  ];
  if (current) {
    const name = worktreeName(current.path);
    items.push(
      SEPARATOR,
      {
        label: `${main.branch ?? "Ana branch"}'e al`,
        icon: GitMerge,
        onSelect: () => void mergeHome(current.path, name),
      },
      {
        label: "Worktree'yi sil",
        icon: Trash2,
        danger: true,
        onSelect: () => void removeWorktree(current.path, name),
      },
    );
  }

  return (
    <>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={at !== null}
        disabled={busy}
        title={current ? `Worktree: ${current.path}` : "Agent'ın çalıştığı checkout"}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setAt(at ? null : { x: r.left, y: r.bottom + 6 });
        }}
        className={cn(
          "inline-flex h-7 max-w-full min-w-0 shrink items-center gap-1.5 rounded-md px-2 text-xs transition-colors duration-fast disabled:opacity-60",
          at ? "bg-glass text-fg" : "text-fg-muted hover:bg-glass hover:text-fg",
          busy && "animate-pulse",
        )}
      >
        {current ? (
          <FolderGit2 size={13} strokeWidth={1.75} aria-hidden className="shrink-0" />
        ) : (
          <Monitor size={13} strokeWidth={1.75} aria-hidden className="shrink-0" />
        )}
        <span className="truncate">{current ? worktreeName(current.path) : "Mevcut checkout"}</span>
        <ChevronDown size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-fg-subtle" />
      </button>
      {at && (
        <ContextMenu x={at.x} y={at.y} label="Checkout" items={items} onClose={() => setAt(null)} />
      )}
    </>
  );
}
