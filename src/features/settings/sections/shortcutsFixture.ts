// DEV builds only, for screenshots in a plain browser (`npm run dev`), where key presses
// cannot be scripted:
//
//   ?settings=<section>    opens Settings on that section (e.g. shortcuts)
//   &keys=capture          Shortcuts: "Toggle sidebar" is recording keys
//   &keys=conflict         Shortcuts: Ctrl+` was pressed for "Go to Changes" and is taken
//
// With `keys`, "New chat" also gets a changed binding, so a row shows the reset mark.
import type { ActionId } from "@/features/keymap/actions";
import { useSettingsStore } from "@/features/settings/store";
import {
  openSettings,
  SETTINGS_SECTIONS,
  type SettingsSection,
} from "@/features/settings/viewStore";
import type { ShortcutEdit } from "./ShortcutsSection";

const params = () => new URLSearchParams(globalThis.location?.search ?? "");

/** The row state `&keys=` asks for, or null (always null outside DEV). */
export function devShortcutsSeed(): ShortcutEdit | null {
  if (!import.meta.env.DEV) return null;
  const keys = params().get("keys");
  const id = (value: ActionId) => value;
  if (keys === "capture") return { id: id("view.toggleSidebar"), phase: "capture" };
  if (keys === "conflict") {
    return {
      id: id("view.changes"),
      phase: "conflict",
      binding: "ctrl+`",
      other: id("view.toggleTerminal"),
    };
  }
  return null;
}

/** Applies `?settings=` and `&keys=` once at startup. No-op outside DEV. */
export function installSettingsFixture() {
  if (!import.meta.env.DEV) return;
  const q = params();
  const section = q.get("settings");
  if (!section || !(SETTINGS_SECTIONS as readonly string[]).includes(section)) return;
  if (q.has("keys"))
    useSettingsStore.getState().update({ keybindings: { "chat.new": "mod+alt+n" } });
  openSettings(section as SettingsSection);
}
