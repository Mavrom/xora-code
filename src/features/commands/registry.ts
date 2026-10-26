import {
  CircleUserRound,
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
    id: "workspace.refresh",
    title: "Dosya ağacını yenile",
    group: "Dosya",
    icon: RotateCw,
    when: () => useWorkspaceStore.getState().root !== null,
    run: () => requestRefresh(),
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
    id: "workspace.quickOpen",
    title: "Dosyaya git…",
    group: "Dosya",
    shortcut: "mod+p",
    icon: FileSearch,
    when: () => useWorkspaceStore.getState().root !== null,
    run: () => emitCommand(QUICK_OPEN),
  },
  {
    id: "chat.new",
    title: "Yeni sohbet",
    group: "Sohbet",
    shortcut: "mod+n",
    icon: SquarePen,
    run: () => {
      closeSettings();
      emitCommand(NEW_CHAT);
    },
  },
  {
    id: "view.toggleSidebar",
    title: "Kenar çubuğunu göster/gizle",
    group: "Görünüm",
    shortcut: "mod+b",
    icon: PanelLeft,
    run: () => emitCommand(TOGGLE_SIDEBAR),
  },
  {
    id: "view.toggleEditor",
    title: "Editörü göster/gizle",
    group: "Görünüm",
    icon: PanelRight,
    run: () => emitCommand(TOGGLE_EDITOR),
  },
  {
    id: "view.sessions",
    title: "Sohbetlere geç",
    group: "Görünüm",
    shortcut: "ctrl+shift+h",
    icon: MessagesSquare,
    run: () => useUiStore.getState().setSidebarView("sessions"),
  },
  {
    id: "view.explorer",
    title: "Dosya çekmecesini sabitle/bırak",
    group: "Görünüm",
    shortcut: "ctrl+shift+e",
    icon: Files,
    run: toggleFiles,
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
  {
    id: "view.windowLook",
    title: "Pencere saydamlığını aç/kapat",
    group: "Görünüm",
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
    title: "Ayarlar",
    group: "Tercihler",
    shortcut: "mod+,",
    icon: Settings,
    run: () => openSettings(),
  },
  {
    id: "settings.accounts",
    title: "Hesapları yönet",
    group: "Tercihler",
    icon: CircleUserRound,
    run: () => openSettings("accounts"),
  },
  {
    id: "settings.appearance",
    title: "Duvar kağıdı ve görünüm",
    group: "Tercihler",
    icon: Palette,
    run: () => openSettings("appearance"),
  },
];
