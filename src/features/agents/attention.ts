// Flashes Xora in the taskbar when an agent finishes a turn or asks for approval while
// the window is in the background (Settings > Genel > "Bitince haber ver").
import { getCurrentWindow, UserAttentionType } from "@tauri-apps/api/window";
import { useSettingsStore } from "@/features/settings/store";
import type { SessionView } from "./reducer";
import { useAgentStore } from "./store";

export type Attention = "done" | "approval" | null;

/**
 * What changed between two snapshots of the sessions that is worth a nudge: a session
 * started waiting for approval (strongest), or a running turn ended.
 */
export function attentionFor(
  prev: Record<string, SessionView>,
  next: Record<string, SessionView>,
): Attention {
  let found: Attention = null;
  for (const [id, view] of Object.entries(next)) {
    const before = prev[id];
    if (!before) continue;
    if (view.permissions.length > before.permissions.length) return "approval";
    if (before.turn !== "idle" && view.turn === "idle") found = "done";
  }
  return found;
}

function nudge(kind: Exclude<Attention, null>) {
  try {
    getCurrentWindow()
      .requestUserAttention(
        kind === "approval" ? UserAttentionType.Critical : UserAttentionType.Informational,
      )
      .catch(() => undefined);
  } catch {
    // Outside Tauri: nothing to flash.
  }
}

/** Watches the agent store; only nudges while the window does not have focus. */
export function installAttention(store = useAgentStore, settings = useSettingsStore) {
  return store.subscribe((state, prev) => {
    if (state.sessions === prev.sessions || document.hasFocus()) return;
    if (!settings.getState().settings.general.notifyWhenDone) return;
    const kind = attentionFor(prev.sessions, state.sessions);
    if (kind) nudge(kind);
  });
}
