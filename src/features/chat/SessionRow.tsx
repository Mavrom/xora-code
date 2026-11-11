import { shortTitle } from "./sessionTitle";
import { memo, useState, type MouseEvent } from "react";
import { Archive, ArchiveRestore, MessageSquare, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import type { SessionListEntry } from "@/features/agents/sessionList";
import { useAgentStore } from "@/features/agents/store";
import { relativeTime } from "@/features/inbox/relativeTime";
import { worktreeName, worktreeOf } from "@/features/git/worktrees";
import { cn } from "@/shared/ui/cn";
import { ContextMenu } from "@/shared/ui/ContextMenu";
import { SEPARATOR } from "@/shared/ui/menuModel";
import { AgentGlyph } from "./AgentGlyph";
import { openEntry } from "./openEntry";
import { RenameField, RowAction } from "./SessionRowControls";
import { sameRowProps, type SessionRowProps } from "./sessionRowProps";
import { sessionStatus, type SessionStatus } from "./sessionStatus";
import { useUnreadStore } from "./unread";
import { t } from "@/shared/i18n";

/** The row's state in words, for its tooltip and accessible name; `undefined` when idle. */
function rowNote(status: SessionStatus, title: string): string | undefined {
  switch (status) {
    case "approval":
      return t("{title}, waiting for approval", { title });
    case "running":
      return t("{title}, working", { title });
    case "failed":
      return t("{title}, stopped with an error", { title });
    case "unread":
      return t("{title}, new reply", { title });
    case "idle":
      return undefined;
  }
}

const archive = (entry: SessionListEntry, archived: boolean) =>
  useAgentStore
    .getState()
    .archiveSession(entry, archived)
    .catch((err: unknown) => console.warn("sessions: archive failed", err));

const pin = (entry: SessionListEntry, pinned: boolean) =>
  useAgentStore
    .getState()
    .pinSession(entry, pinned)
    .catch((err: unknown) => console.warn("sessions: pin failed", err));

const rename = (entry: SessionListEntry, title: string | null) =>
  useAgentStore
    .getState()
    .renameSession(entry, title)
    .catch((err: unknown) => console.warn("sessions: rename failed", err));

const remove = (entry: SessionListEntry) =>
  useAgentStore
    .getState()
    .deleteSession(entry)
    .catch((err: unknown) => console.warn("sessions: delete failed", err));

/**
 * One conversation. Hover shows archive and delete; right-click opens the same actions.
 * Delete asks once, inside the row, so a stray click never loses a chat.
 *
 * Memoised: the list re-renders on every streamed batch (the store's sessions change), but
 * a row only depends on its entry's fields, the worktrees and its own store selectors.
 */
export const SessionRow = memo(function SessionRow({ entry, worktrees }: SessionRowProps) {
  const worktree = worktreeOf(worktrees, entry.cwd);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const updated = entry.updatedAt ? Date.parse(entry.updatedAt) : NaN;
  const title = entry.title ? shortTitle(entry.title) : t("Untitled chat");
  const unread = useUnreadStore((s) => s.ids.has(entry.sessionId));
  const status = useAgentStore((s) => sessionStatus(s.sessions[entry.sessionId], unread));
  const note = rowNote(status, entry.title ?? title);

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  if (renaming) {
    return (
      <RenameField
        initial={entry.title ?? ""}
        onDone={(name) => {
          setRenaming(false);
          if (name !== null && name !== (entry.title ?? "")) void rename(entry, name);
        }}
      />
    );
  }

  if (confirming) {
    return (
      <div
        role="alertdialog"
        aria-label={t('Delete "{title}"?', { title })}
        onMouseLeave={() => setConfirming(false)}
        className="flex h-8 items-center gap-2 rounded-lg bg-danger-strong/[0.08] pr-1 pl-2.5 text-[12px] ring-1 ring-danger-strong/20 ring-inset"
      >
        <span className="min-w-0 flex-1 truncate text-danger-soft">{t("Delete?")}</span>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="h-6 rounded-md px-2 text-fg-muted transition-colors duration-fast hover:bg-white/[0.06] hover:text-fg"
        >
          {t("Cancel")}
        </button>
        <button
          type="button"
          autoFocus
          onClick={() => void remove(entry)}
          className="h-6 rounded-md bg-danger-strong/80 px-2 font-medium text-white transition-colors duration-fast hover:bg-danger-strong"
        >
          {t("Delete")}
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        onContextMenu={onContextMenu}
        className={cn(
          "group relative flex h-8 items-center rounded-lg transition-[background-color,color] duration-fast",
          entry.active
            ? "bg-white/[0.07] text-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]"
            : "text-fg-muted hover:bg-white/[0.04] hover:text-fg",
          menu && !entry.active && "bg-white/[0.04] text-fg",
        )}
      >
        <button
          type="button"
          onClick={() => openEntry(entry)}
          aria-current={entry.active ? "page" : undefined}
          aria-label={note && (worktree ? `${note} ${worktreeName(worktree.path)}` : note)}
          title={note ?? entry.title ?? undefined}
          className="flex h-full min-w-0 flex-1 items-center gap-2.5 rounded-lg pl-2.5 text-left text-[13px]"
        >
          {status === "running" ? (
            // Working: a soft pulse in place of the agent mark.
            <span aria-hidden className="relative grid size-3.5 shrink-0 place-items-center">
              <span className="absolute size-2 animate-ping rounded-full bg-fg/40" />
              <span className="size-1.5 rounded-full bg-fg" />
            </span>
          ) : status !== "idle" ? (
            // Waiting, failed or unread: a still dot in the same place, so rows never shift.
            <span aria-hidden className="grid size-3.5 shrink-0 place-items-center">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  status === "approval" && "bg-warning ring-2 ring-warning/25",
                  status === "failed" && "bg-danger",
                  status === "unread" && "bg-fg",
                )}
              />
            </span>
          ) : (
            <AgentGlyph
              agent={entry.agentId}
              size={13}
              tinted={entry.active}
              className={cn(
                "transition-colors duration-fast",
                !entry.active && "text-fg-subtle/70 group-hover:text-fg-subtle",
              )}
            />
          )}
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              status === "running" && "shimmer",
              (status === "approval" || status === "unread") && "text-fg",
            )}
          >
            {title}
          </span>
          {worktree && (
            <span
              title={t("Worktree: {name}", { name: worktree.branch ?? worktree.path })}
              className="shrink-0 rounded-md bg-white/[0.06] px-1.5 font-mono text-[10px] leading-4 text-fg-subtle"
            >
              {worktreeName(worktree.path)}
            </span>
          )}
        </button>
        <span className="relative mr-1.5 ml-1 flex h-full shrink-0 items-center">
          {status !== "running" && status !== "approval" && Number.isFinite(updated) && (
            <span className="text-[11px] text-fg-subtle/70 tabular-nums transition-opacity duration-fast group-focus-within:opacity-0 group-hover:opacity-0">
              {relativeTime(updated)}
            </span>
          )}
          <span className="absolute right-0 flex items-center gap-0.5 opacity-0 transition-opacity duration-fast group-focus-within:opacity-100 group-hover:opacity-100">
            {!entry.archived && (
              <RowAction
                icon={entry.pinned ? PinOff : Pin}
                label={entry.pinned ? t("Unpin") : t("Pin")}
                onClick={() => void pin(entry, !entry.pinned)}
              />
            )}
            <RowAction
              icon={entry.archived ? ArchiveRestore : Archive}
              label={entry.archived ? t("Unarchive") : t("Archive")}
              onClick={() => void archive(entry, !entry.archived)}
            />
            <RowAction
              icon={Trash2}
              label={t("Delete")}
              danger
              onClick={() => setConfirming(true)}
            />
          </span>
        </span>
      </div>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          label={title}
          onClose={() => setMenu(null)}
          items={[
            { label: t("Open"), icon: MessageSquare, onSelect: () => openEntry(entry) },
            { label: t("Rename"), icon: Pencil, onSelect: () => setRenaming(true) },
            ...(entry.archived
              ? []
              : [
                  entry.pinned
                    ? {
                        label: t("Unpin"),
                        icon: PinOff,
                        onSelect: () => void pin(entry, false),
                      }
                    : { label: t("Pin"), icon: Pin, onSelect: () => void pin(entry, true) },
                ]),
            SEPARATOR,
            entry.archived
              ? {
                  label: t("Unarchive"),
                  icon: ArchiveRestore,
                  onSelect: () => void archive(entry, false),
                }
              : { label: t("Archive"), icon: Archive, onSelect: () => void archive(entry, true) },
            SEPARATOR,
            { label: t("Delete"), icon: Trash2, danger: true, onSelect: () => setConfirming(true) },
          ]}
        />
      )}
    </>
  );
}, sameRowProps);
