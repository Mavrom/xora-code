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
}

export const ACTIONS = [
  {
    id: "palette.open",
    defaults: ["mod+k", "mod+shift+p"],
    scope: "global",
    title: t("Command palette"),
    group: t("General"),
  },
  { id: "workspace.quickOpen", defaults: ["mod+p"], scope: "global" },
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
  { id: "editor.save", defaults: ["mod+s"], scope: "global" },
  { id: "editor.closeTab", defaults: ["mod+w"], scope: "global" },
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

/** Whether `id` is one of the actions above (the ones with a dedicated handler). */
export const isActionId = (id: string): id is ActionId => BY_ID.has(id);

// Every command palette entry is bindable too. The command registry registers its ids when
// it loads (`commands/registry.ts`); such an action has the command's id, no default binding
// and the global scope, and `commands/commandShortcuts.ts` runs it. Commands that are also
// in `ACTIONS` keep their dedicated handler and are not registered again.

/** Any bindable action: one of `ACTIONS` or a registered palette command. */
export type BindableId = string;

const commandIds = new Set<string>();
const commandListeners = new Set<() => void>();

/** Makes palette commands bindable; ids already in `ACTIONS` are skipped. */
export function registerCommandActions(ids: readonly string[]) {
  let added = false;
  for (const id of ids) {
    if (BY_ID.has(id) || commandIds.has(id) || !isWellFormedActionId(id)) continue;
    commandIds.add(id);
    added = true;
  }
  if (added) for (const listener of commandListeners) listener();
}

/** Calls `listener` whenever more commands become bindable; returns the unsubscribe. */
export function onCommandActions(listener: () => void) {
  commandListeners.add(listener);
  return () => void commandListeners.delete(listener);
}

/** The registered palette commands that have no dedicated handler, in registration order. */
export const commandActionIds = (): BindableId[] => [...commandIds];

export const isCommandAction = (id: string) => commandIds.has(id);

/** Whether `id` can be bound: one of `ACTIONS` or a registered palette command. */
export const isBindable = (id: string): id is BindableId => BY_ID.has(id) || commandIds.has(id);

/** Every bindable id: `ACTIONS` first, then the registered commands. */
export const bindableIds = (): BindableId[] => [...ACTIONS.map((a) => a.id), ...commandIds];

const COMMAND_DEF = { defaults: [], scope: "global" } as const;

export const actionDef = (id: BindableId): ActionDef => BY_ID.get(id) ?? { id, ...COMMAND_DEF };

/**
 * The shape of an action id: dot-separated segments of ASCII letters and digits, each
 * starting with a lowercase letter, at least two segments, at most 64 characters
 * (`view.toggleSidebar`, `git.stageAll`). The settings file keeps an entry only for an id
 * of this shape (`is_action_id` in `src-tauri/src/settings/keybindings.rs`, same rule).
 */
export const isWellFormedActionId = (id: string) =>
  id.length <= 64 && /^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)+$/.test(id);
