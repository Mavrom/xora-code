import { useEffect, type RefObject } from "react";
import { NEW_CHAT, onChatDraft, onCommand } from "@/features/commands/events";
import { isPaletteOpen } from "@/features/commands/paletteGuard";
import { useAgentStore } from "@/features/agents/store";
import { matchesAction } from "@/features/keymap/keymap";
import type { ComposerHandle } from "./Composer";

/** Requests from outside the chat that land in the composer. */
export function useComposerEvents(composerRef: RefObject<ComposerHandle | null>) {
  // An Inbox note sent to the chat lands in the composer, ready to edit and send.
  useEffect(
    () =>
      onChatDraft((text, append) =>
        append ? composerRef.current?.append(text) : composerRef.current?.fill(text),
      ),
    [composerRef],
  );

  // "Yeni sohbet" from the sidebar, or its shortcut (Ctrl+N, Cmd+N on macOS) anywhere.
  useEffect(() => {
    const start = () => {
      useAgentStore.getState().setActiveSession(null);
      requestAnimationFrame(() => composerRef.current?.focus());
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || isPaletteOpen() || !matchesAction(e, "chat.new")) return;
      e.preventDefault();
      start();
    };
    window.addEventListener("keydown", onKeyDown, true);
    const off = onCommand(NEW_CHAT, start);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      off();
    };
  }, [composerRef]);
}
