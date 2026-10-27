import {
  CircleUserRound,
  Copy,
  Download,
  Files,
  MessagesSquare,
  FileSearch,
  FolderOpen,
  Inbox,
  PanelLeft,
  PanelRight,
  RotateCw,
  Palette,
  Blend,
  Save,
  Settings,
  SquarePen,
  SquareTerminal,
  X,
  type LucideIcon,
} from "lucide-react";
import { toggleFiles, useUiStore } from "@/app/uiStore";
import { closeActiveTab } from "@/features/editor/closeTab";
import { useEditorStore } from "@/features/editor/store";
import { INBOX_COMPOSER_ID } from "@/features/inbox/NoteComposer";
import { useInboxStore } from "@/features/inbox/store";
import { requestRefresh } from "@/features/workspace/fsWatch";
import { closeSettings, openSettings } from "@/features/settings/viewStore";
import { canExportChat, copyChatMarkdown, exportChatMarkdown } from "@/features/chat/exportChat";
import { useSettingsStore } from "@/features/settings/store";
import { openFolder } from "@/features/workspace/openFolder";
import { useWorkspaceStore } from "@/features/workspace/store";
import {
  emitCommand,
  NEW_CHAT,
  QUICK_OPEN,
  SAVE_ACTIVE_FILE,
  TOGGLE_EDITOR,
  TOGGLE_SIDEBAR,
  TOGGLE_TERMINAL,
} from "./events";
import type { Rankable } from "./results";
import { t } from "@/shared/i18n";

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
    title: t("Open folder"),
    group: t("File"),
    icon: FolderOpen,
    run: () => void openFolder(),
  },
  {
    id: "workspace.refresh",
    title: t("Refresh file tree"),
    group: t("File"),
    icon: RotateCw,
    when: () => useWorkspaceStore.getState().root !== null,
    run: () => requestRefresh(),
  },
  {
    id: "editor.save",
    title: t("Save active file"),
    group: t("File"),
    shortcut: "mod+s",
    icon: Save,
    when: hasActiveTab,
    run: () => emitCommand(SAVE_ACTIVE_FILE),
  },
  {
    id: "editor.closeTab",
    title: t("Close active tab"),
    group: t("File"),
    shortcut: "mod+w",
    icon: X,
    when: hasActiveTab,
    run: closeActiveTab,
  },
  {
    id: "workspace.quickOpen",
    title: t("Go to file…"),
    group: t("File"),
    shortcut: "mod+p",
    icon: FileSearch,
    when: () => useWorkspaceStore.getState().root !== null,
    run: () => emitCommand(QUICK_OPEN),
  },
  {
    id: "chat.new",
    title: t("New chat"),
    group: t("Chat"),
    shortcut: "mod+n",
    icon: SquarePen,
    run: () => {
      closeSettings();
      emitCommand(NEW_CHAT);
    },
  },
  {
    id: "chat.copyMarkdown",
    title: t("Copy chat as Markdown"),
    group: t("Chat"),
    icon: Copy,
    when: canExportChat,
    run: () => void copyChatMarkdown().catch(() => undefined),
  },
  {
    id: "chat.export",
    title: t("Export chat…"),
    group: t("Chat"),
    icon: Download,
    when: canExportChat,
    run: () => void exportChatMarkdown().catch((err: unknown) => console.error(err)),
  },
  {
    id: "view.toggleSidebar",
    title: t("Toggle sidebar"),
    group: t("View"),
    shortcut: "mod+b",
    icon: PanelLeft,
    run: () => emitCommand(TOGGLE_SIDEBAR),
  },
  {
    id: "view.toggleEditor",
    title: t("Toggle editor"),
    group: t("View"),
    icon: PanelRight,
    run: () => emitCommand(TOGGLE_EDITOR),
  },
  {
    id: "view.sessions",
    title: t("Go to chats"),
    group: t("View"),
    shortcut: "ctrl+shift+h",
    icon: MessagesSquare,
    run: () => useUiStore.getState().setSidebarView("sessions"),
  },
  {
    id: "view.explorer",
    title: t("Pin or unpin the files drawer"),
    group: t("View"),
    shortcut: "ctrl+shift+e",
    icon: Files,
    run: toggleFiles,
  },
  {
    id: "view.inbox",
    title: t("Go to Inbox"),
    group: t("View"),
    shortcut: "ctrl+shift+n",
    icon: Inbox,
    run: showInbox,
  },
  {
    id: "inbox.newNote",
    title: t("New note"),
    group: t("Inbox"),
    icon: SquarePen,
    // The composer is disabled until notes have loaded.
    when: () => useInboxStore.getState().status === "ready",
    run: showInbox,
  },
  {
    id: "view.toggleTerminal",
    title: t("Toggle terminal"),
    group: t("View"),
    shortcut: "ctrl+`",
    icon: SquareTerminal,
    run: () => emitCommand(TOGGLE_TERMINAL),
  },
  {
    id: "view.windowLook",
    title: t("Toggle window transparency"),
    group: t("View"),
    icon: Blend,
    run: () => {
      const { settings, update } = useSettingsStore.getState();
      update({
        appearance: { window: settings.appearance.window === "solid" ? "frosted" : "solid" },
      });
    },
  },
  {
    id: "settings.open",
    title: t("Settings"),
    group: t("Preferences"),
    shortcut: "mod+,",
    icon: Settings,
    run: () => openSettings(),
  },
  {
    id: "settings.accounts",
    title: t("Manage accounts"),
    group: t("Preferences"),
    icon: CircleUserRound,
    run: () => openSettings("accounts"),
  },
  {
    id: "settings.appearance",
    title: t("Wallpaper and appearance"),
    group: t("Preferences"),
    icon: Palette,
    run: () => openSettings("appearance"),
  },
];
