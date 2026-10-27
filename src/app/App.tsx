import { useEffect, useState } from "react";
import { useAgentEvents } from "@/features/agents/useAgentEvents";
import { CommandPalette } from "@/features/commands/CommandPalette";
import { onCommand, OPEN_PALETTE, QUICK_OPEN } from "@/features/commands/events";
import { QuickOpen } from "@/features/files/QuickOpen";
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

export default function App() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  usePaletteShortcut(() => setPaletteOpen((open) => !open));
  useEffect(() => onCommand(OPEN_PALETTE, () => setPaletteOpen(true)), []);
  const [quickOpen, setQuickOpen] = useState(false);
  useEffect(() => onCommand(QUICK_OPEN, () => setQuickOpen(true)), []);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || !isQuickOpenShortcut(e)) return;
      e.preventDefault();
      e.stopPropagation();
      setPaletteOpen(false);
      setQuickOpen((open) => !open);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);
  useAgentEvents();

  return (
    <>
      <Layout />
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      {quickOpen && <QuickOpen onClose={() => setQuickOpen(false)} />}
    </>
  );
}
