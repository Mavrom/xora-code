import {
  Files,
  FolderOpen,
  Inbox,
  PanelRight,
  Save,
  SquarePen,
  SquareTerminal,
  X,
  type LucideIcon,
} from "lucide-react";
import { useUiStore } from "@/app/uiStore";
import { closeActiveTab } from "@/features/editor/closeTab";
import { useEditorStore } from "@/features/editor/store";
import { INBOX_COMPOSER_ID } from "@/features/inbox/NoteComposer";
import { useInboxStore } from "@/features/inbox/store";
import { openFolder } from "@/features/workspace/openFolder";
import { emitCommand, SAVE_ACTIVE_FILE, TOGGLE_EDITOR, TOGGLE_TERMINAL } from "./events";
import type { Rankable } from "./results";

export interface Command extends Rankable {
  id: string;
  title: string;
  group: string;
  /** Display only, portable `Kbd` form (e.g. "ctrl+shift+e"); the binding lives with the feature. */
  shortcut?: string;
  icon?: LucideIcon;
  run: () => void;
}

const hasActiveTab = () => useEditorStore.getState().activePath !== null;

/** Switches the sidebar to the inbox and lands in the composer (like the activity bar). */
function showInbox() {
  useUiStore.getState().setSidebarView("inbox");
  requestAnimationFrame(() => document.getElementById(INBOX_COMPOSER_ID)?.focus());
}

export const COMMANDS: Command[] = [
  {
    id: "workspace.openFolder",
    title: "Klasör aç",
    group: "Dosya",
    icon: FolderOpen,
    run: () => void openFolder(),
  },
  {
    id: "editor.save",
    title: "Aktif dosyayı kaydet",
    group: "Dosya",
    shortcut: "mod+s",
    icon: Save,
    when: hasActiveTab,
    run: () => emitCommand(SAVE_ACTIVE_FILE),
  },
  {
    id: "editor.closeTab",
    title: "Aktif sekmeyi kapat",
    group: "Dosya",
    shortcut: "mod+w",
    icon: X,
    when: hasActiveTab,
    run: closeActiveTab,
  },
  {
    id: "view.toggleEditor",
    title: "Editörü göster/gizle",
    group: "Görünüm",
    icon: PanelRight,
    run: () => emitCommand(TOGGLE_EDITOR),
  },
  {
    id: "view.explorer",
    title: "Explorer'a geç",
    group: "Görünüm",
    shortcut: "ctrl+shift+e",
    icon: Files,
    run: () => useUiStore.getState().setSidebarView("explorer"),
  },
  {
    id: "view.inbox",
    title: "Inbox'a geç",
    group: "Görünüm",
    shortcut: "ctrl+shift+n",
    icon: Inbox,
    run: showInbox,
  },
  {
    id: "inbox.newNote",
    title: "Yeni not",
    group: "Inbox",
    icon: SquarePen,
    // The composer is disabled until notes have loaded.
    when: () => useInboxStore.getState().status === "ready",
    run: showInbox,
  },
  {
    id: "view.toggleTerminal",
    title: "Terminali aç/kapat",
    group: "Görünüm",
    shortcut: "ctrl+`",
    icon: SquareTerminal,
    run: () => emitCommand(TOGGLE_TERMINAL),
  },
];
