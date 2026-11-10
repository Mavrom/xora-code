// The app's bindable actions: every app-level shortcut, with its default binding. Each
// handler stays where it was (its phase, guards and focus rules are its own) and asks the
// keymap whether an event is its action instead of spelling the keys out.
//
// Deliberately NOT in the keymap (left as hand-written key handling):
// - text editing in the chat composer (`chat/composerKeys.ts`: Enter / Shift+Enter /
//   Ctrl+Enter to send, history, the @ mention and / command popovers);
// - list and dialog navigation (arrows, Home/End, Enter, Esc, Tab inside the palette,
//   quick open, find in files, trees, menus, tab strips, Settings' own navigation);
// - Monaco's own editor bindings (Ctrl+F, Ctrl+Z, multi-cursor, …);
// - terminal key handling (`terminal/keys.ts` clipboard keys, Ctrl+PageUp/PageDown);
// - the dialog-local toggles Alt+C / Alt+W / Alt+R in find in files (`search/shortcut.ts`),
//   Ctrl+Enter in the commit box and Ctrl+Z in the Inbox.
import type { LetterMatch } from "./binding";
import { t } from "@/shared/i18n";

/**
 * Where an action listens. `global`: window or document capture listeners, wherever focus
 * is. `editor`: inside the code editor (a Monaco keybinding). `composer`: while the chat
 * composer has focus. Global overlaps every scope; the other two do not overlap each other.
 */
export type Scope = "global" | "editor" | "composer";

export interface ActionDef {
  id: string;
  /** Portable bindings in canonical form; the first is the one shown. */
  defaults: readonly string[];
  scope: Scope;
  /**
   * Title and group for the shortcut list when the command registry has no command with
   * this id (registry commands bring their own).
   */
  title?: string;
  group?: string;
  /** Letters by typed character instead of physical key (how the handler always matched). */
  letters?: LetterMatch;
}

export const ACTIONS = [
  {
    id: "palette.open",
    defaults: ["mod+k", "mod+shift+p"],
    scope: "global",
    title: t("Command palette"),
    group: t("General"),
    letters: "char",
  },
  { id: "workspace.quickOpen", defaults: ["mod+p"], scope: "global", letters: "char" },
  { id: "search.findInFiles", defaults: ["mod+shift+f"], scope: "global" },
  { id: "chat.new", defaults: ["mod+n"], scope: "global" },
  { id: "view.toggleSidebar", defaults: ["mod+b"], scope: "global" },
  // Control, not Cmd, on macOS too.
  { id: "view.explorer", defaults: ["ctrl+shift+e"], scope: "global" },
  { id: "view.sessions", defaults: ["ctrl+shift+h"], scope: "global" },
  { id: "view.inbox", defaults: ["ctrl+shift+n"], scope: "global" },
  { id: "view.changes", defaults: ["ctrl+shift+g"], scope: "global" },
  { id: "view.toggleTerminal", defaults: ["ctrl+`"], scope: "global" },
  {
    id: "terminal.new",
    defaults: ["ctrl+shift+`"],
    scope: "global",
    title: t("New terminal"),
    group: t("View"),
  },
  { id: "editor.save", defaults: ["mod+s"], scope: "global", letters: "char" },
  { id: "editor.closeTab", defaults: ["mod+w"], scope: "global", letters: "char" },
  { id: "settings.open", defaults: ["mod+,"], scope: "global" },
  {
    id: "view.zoomIn",
    defaults: ["mod+plus"],
    scope: "global",
    title: t("Zoom in"),
    group: t("View"),
  },
  {
    id: "view.zoomOut",
    defaults: ["mod+-"],
    scope: "global",
    title: t("Zoom out"),
    group: t("View"),
  },
  {
    id: "view.zoomReset",
    defaults: ["mod+0"],
    scope: "global",
    title: t("Reset zoom"),
    group: t("View"),
  },
  {
    id: "editor.addToChat",
    defaults: ["mod+l"],
    scope: "editor",
    title: t("Add selection to chat"),
    group: t("Editor"),
  },
  // While a diff tab is on screen.
  {
    id: "diff.next",
    defaults: ["alt+f5"],
    scope: "global",
    title: t("Next change"),
    group: t("Editor"),
  },
  {
    id: "diff.previous",
    defaults: ["shift+alt+f5"],
    scope: "global",
    title: t("Previous change"),
    group: t("Editor"),
  },
  // While a turn runs.
  {
    id: "chat.stop",
    defaults: ["escape"],
    scope: "composer",
    title: t("Stop the running turn"),
    group: t("Chat"),
  },
] as const satisfies readonly ActionDef[];

export type ActionId = (typeof ACTIONS)[number]["id"];

const BY_ID = new Map<string, ActionDef>(ACTIONS.map((a) => [a.id, a]));

export const actionDef = (id: ActionId): ActionDef => BY_ID.get(id) as ActionDef;

export const isActionId = (id: string): id is ActionId => BY_ID.has(id);
