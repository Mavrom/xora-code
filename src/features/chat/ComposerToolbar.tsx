import { useState, type ReactNode } from "react";
import { ChevronDown, FileCode, FilePlus, FolderPlus, Monitor, Paperclip } from "lucide-react";
import { cn } from "@/shared/ui/cn";
import { ContextMenu } from "@/shared/ui/ContextMenu";
import type { MenuEntry } from "@/shared/ui/menuModel";
import { ChipMenu } from "./ChipMenu";
import { contextRatio, formatTokens } from "./format";
import { t } from "@/shared/i18n";

/** Muted chip look of the line above and below the composer. */
const quietChip =
  "inline-flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-md px-2 text-xs text-fg-muted transition-colors duration-fast hover:bg-glass hover:text-fg";

/**
 * One part of the context line under the composer: muted text with a small chevron, lifted
 * on hover and keyboard focus so it reads as a control without competing with the composer.
 */
export const contextPart =
  "group/part inline-flex h-6 max-w-full min-w-0 shrink items-center gap-0.5 rounded-md pr-1 pl-1.5 text-xs text-fg-subtle transition-colors duration-fast hover:bg-glass hover:text-fg-muted focus-visible:bg-glass focus-visible:text-fg-muted aria-expanded:bg-glass aria-expanded:text-fg-muted";

/** The chevron that marks a context-line part as something that opens. */
export function ContextChevron() {
  return (
    <ChevronDown
      size={11}
      strokeWidth={2}
      aria-hidden
      className="shrink-0 opacity-60 transition-opacity duration-fast group-hover/part:opacity-100 group-focus-visible/part:opacity-100"
    />
  );
}

interface AttachMenuProps {
  onPickFiles: () => void;
  onPickFolder: () => void;
  /** The file open in the editor, offered as a one-click mention. */
  openFile: { name: string; onAdd: () => void } | null;
}

/** The paperclip: a small menu of things to mention in the message (`@path`). */
export function AttachMenu({ onPickFiles, onPickFolder, openFile }: AttachMenuProps) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const items: MenuEntry[] = [
    { label: t("File…"), icon: FilePlus, onSelect: onPickFiles },
    { label: t("Folder…"), icon: FolderPlus, onSelect: onPickFolder },
  ];
  if (openFile) {
    items.push("separator", {
      label: t("Open file: {name}", { name: openFile.name }),
      icon: FileCode,
      onSelect: openFile.onAdd,
    });
  }
  return (
    <>
      <button
        type="button"
        aria-label={t("Add")}
        aria-haspopup="menu"
        aria-expanded={at !== null}
        title={t("Add")}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setAt(at ? null : { x: r.left, y: r.bottom + 6 });
        }}
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-md transition-colors duration-fast",
          at ? "bg-hover text-fg" : "text-fg-subtle hover:bg-hover hover:text-fg",
        )}
      >
        <Paperclip size={15} strokeWidth={1.75} aria-hidden />
      </button>
      {at && (
        <ContextMenu x={at.x} y={at.y} label={t("Add")} items={items} onClose={() => setAt(null)} />
      )}
    </>
  );
}

/** Small ring that fills with the context window; turns warm near the limit. */
/** Below this share of the context window the meter stays hidden. */
const CONTEXT_METER_MIN = 0.5;

export function ContextMeter({ used, size }: { used: number; size: number }) {
  const ratio = contextRatio(used, size);
  // Only worth a glance once the window starts to fill; a near-empty ring reads as a spinner.
  if (ratio < CONTEXT_METER_MIN) return null;
  const percent = Math.round(ratio * 100);
  const r = 6;
  const circumference = 2 * Math.PI * r;
  const label = t("Context: {percent}% · {used} / {size}", {
    percent,
    used: formatTokens(used),
    size: formatTokens(size),
  });
  return (
    <span role="img" aria-label={label} title={label} className="grid size-7 place-items-center">
      <svg viewBox="0 0 16 16" className="size-4 -rotate-90" aria-hidden>
        <circle cx="8" cy="8" r={r} fill="none" strokeWidth="2" className="stroke-border-strong" />
        <circle
          cx="8"
          cy="8"
          r={r}
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className={cn(
            "transition-[stroke-dashoffset] duration-slow ease-out-quint",
            ratio > 0.95 ? "stroke-danger" : ratio > 0.8 ? "stroke-warning" : "stroke-fg-muted",
          )}
        />
      </svg>
    </span>
  );
}

/** Where the agent runs: this computer. The only place for now, so the menu has one entry. */
export function HostChip({ hostname }: { hostname: string | null }) {
  const name = hostname ?? t("This computer");
  return (
    <ChipMenu
      label={t("Environment")}
      side="top"
      align="end"
      buttonClassName={cn(quietChip, "uppercase")}
      leading={<Monitor size={13} strokeWidth={1.75} aria-hidden className="shrink-0" />}
      display={name}
      sections={[
        {
          key: "host",
          label: t("Environment"),
          value: "local",
          options: [{ value: "local", name, description: t("The agent runs on this computer.") }],
          onSelect: () => {},
        },
      ]}
    />
  );
}

/** Opens another folder; the folder the agent works in. */
export function FolderChip({
  folderName,
  onOpenFolder,
}: {
  folderName: string | null;
  onOpenFolder: () => void;
}) {
  const label = folderName
    ? t("Folder: {name}. Open another folder", { name: folderName })
    : t("Choose a folder");
  return (
    <button
      type="button"
      onClick={onOpenFolder}
      aria-label={label}
      title={folderName ? t("Open another folder") : t("Open folder")}
      className={contextPart}
    >
      <span className="truncate">{folderName ?? t("Choose a folder")}</span>
      <ContextChevron />
    </button>
  );
}

interface ContextRowProps {
  /** Where the agent works: the folder. */
  folder: ReactNode;
  /** The checkout (repository or worktree) menu; it names the branch itself when present. */
  checkout?: ReactNode;
  branch: string | null;
  /** Right-aligned quiet content (the stop hint while a turn runs). */
  aside?: ReactNode;
}

const Dot = () => (
  <span aria-hidden className="shrink-0 text-2xs text-fg-subtle/60">
    ·
  </span>
);

/**
 * The one quiet line under the composer: folder · branch (or worktree). The folder part opens
 * another folder, the checkout part its menu; a branch outside a repository menu is plain text.
 */
export function ContextRow({ folder, checkout, branch, aside }: ContextRowProps) {
  return (
    <div className="mt-1.5 flex min-h-6 items-center gap-0.5 px-1 @container">
      {folder}
      {checkout ? (
        <>
          <Dot />
          {checkout}
        </>
      ) : (
        branch && (
          <>
            <Dot />
            <span
              title={t("Git branch: {branch}", { branch })}
              className="inline-flex h-6 max-w-full min-w-0 shrink items-center px-1.5 text-xs text-fg-subtle"
            >
              <span className="truncate">{branch}</span>
            </span>
          </>
        )
      )}
      <span className="flex-1" />
      {aside && <div className="hidden shrink-0 @[34rem]:block">{aside}</div>}
    </div>
  );
}
