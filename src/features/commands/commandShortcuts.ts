// Shortcuts for palette commands without a dedicated handler (Settings > Shortcuts can bind
// any of them; none has a default). One window capture listener resolves the key press to
// such a command and runs it the way the palette would, if it is available right now.
//
// Order with the other listeners: installed in App after the capture guard (recording a
// shortcut takes every key first) and the palette guard. While the palette or an in-app
// dialog is open it does nothing. Commands that are also keymap actions (save, new chat,
// the sidebar views, …) are left to their own handlers, so nothing runs twice.
import { isCommandAction } from "@/features/keymap/actions";
import type { KeyEventLike } from "@/features/keymap/binding";
import { matchesBindable } from "@/features/keymap/keymap";
import { isModalOpen } from "@/shared/ui/modalGuard";
import { isPaletteOpen } from "./paletteGuard";
import { COMMANDS, type Command } from "./registry";

type Runnable = Pick<Command, "id" | "when" | "run">;

interface KeyPress extends KeyEventLike {
  repeat: boolean;
  defaultPrevented: boolean;
  preventDefault(): void;
  stopPropagation(): void;
}

/** The palette command (without a dedicated handler) a key press is bound to, if any. */
export function commandForKey<T extends Runnable>(e: KeyEventLike, commands: readonly T[]) {
  return commands.find((c) => isCommandAction(c.id) && matchesBindable(e, c.id)) ?? null;
}

/**
 * Handles one key press: runs the bound command when it is available (its `when` holds),
 * and only then claims the key. A held key runs it once. Returns whether the key was taken.
 */
export function handleCommandKey(
  e: KeyPress,
  commands: readonly Runnable[] = COMMANDS,
  blocked = isPaletteOpen() || isModalOpen(),
): boolean {
  if (e.defaultPrevented || blocked) return false;
  const command = commandForKey(e, commands);
  if (!command || (command.when && !command.when())) return false;
  e.preventDefault();
  // Capture phase plus stopPropagation: Monaco and xterm never see the key.
  e.stopPropagation();
  if (!e.repeat) command.run();
  return true;
}

let installed = false;

/** Installs the listener once; call it after the capture and palette guards. */
export function installCommandShortcuts(target: Pick<Window, "addEventListener"> = window) {
  if (installed) return;
  installed = true;
  target.addEventListener("keydown", (e) => void handleCommandKey(e), true);
}
