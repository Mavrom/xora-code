import { useEffect, useState } from "react";
import { useAgentEvents } from "@/features/agents/useAgentEvents";
import { CommandPalette } from "@/features/commands/CommandPalette";
import { FIND_IN_FILES, onCommand, OPEN_PALETTE, QUICK_OPEN } from "@/features/commands/events";
import { QuickOpen } from "@/features/files/QuickOpen";
import { FindInFiles } from "@/features/search/FindInFiles";
import { seedFromEditor } from "@/features/search/searchStore";
import { isFindInFilesShortcut } from "@/features/search/shortcut";
import { installAttention } from "@/features/agents/attention";
import { installModelCatalog } from "@/features/agents/modelCatalog";
import { installAutoSave } from "@/features/editor/autoSave";
import { installUiPrefs } from "./uiPrefs";
import { installLanguage } from "./language";
import { installWindowLook } from "./windowLook";
import { installSessionReaper } from "@/features/agents/sessionReaper";
import { installNavHistory } from "@/features/chat/navHistory";
import { installPaletteGuard } from "@/features/commands/paletteGuard";
import { installContextMenuGuard } from "@/shared/ui/menuModel";
import { isQuickOpenShortcut, usePaletteShortcut } from "@/features/commands/usePaletteShortcut";
import { Layout } from "./Layout";

// Before the first render, so it runs ahead of every feature's own shortcut listener.
installPaletteGuard();
installLanguage();
installNavHistory();
installSessionReaper();
installModelCatalog();
installAttention();
installWindowLook();
installUiPrefs();
installAutoSave();
installContextMenuGuard();

/** The overlay dialogs; at most one is open, and each shortcut toggles its own. */
type Overlay = "palette" | "quickOpen" | "find";

const toggle = (next: Overlay) => (open: Overlay | null) => (open === next ? null : next);

export default function App() {
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const close = () => setOverlay(null);
  usePaletteShortcut(() => setOverlay(toggle("palette")));
  useEffect(() => onCommand(OPEN_PALETTE, () => setOverlay("palette")), []);
  useEffect(() => onCommand(QUICK_OPEN, () => setOverlay("quickOpen")), []);
  // From the palette: it has already given focus back to the editor, so a selection seeds.
  useEffect(
    () =>
      onCommand(FIND_IN_FILES, () => {
        seedFromEditor();
        setOverlay("find");
      }),
    [],
  );
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const next = isQuickOpenShortcut(e) ? "quickOpen" : isFindInFilesShortcut(e) ? "find" : null;
      if (!next) return;
      // Capture phase plus stopPropagation: Monaco never sees the keys.
      e.preventDefault();
      e.stopPropagation();
      // Only while the editor has focus, so closing the dialog this way never re-seeds.
      if (next === "find") seedFromEditor();
      setOverlay(toggle(next));
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);
  useAgentEvents();

  return (
    <>
      <Layout />
      {overlay === "palette" && <CommandPalette onClose={close} />}
      {overlay === "quickOpen" && <QuickOpen onClose={close} />}
      {overlay === "find" && <FindInFiles onClose={close} />}
    </>
  );
}
