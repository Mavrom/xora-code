import { useEffect, useState } from "react";
import { useAgentEvents } from "@/features/agents/useAgentEvents";
import { CommandPalette } from "@/features/commands/CommandPalette";
import { onCommand, OPEN_PALETTE } from "@/features/commands/events";
import { installSessionReaper } from "@/features/agents/sessionReaper";
import { installNavHistory } from "@/features/chat/navHistory";
import { installPaletteGuard } from "@/features/commands/paletteGuard";
import { installContextMenuGuard } from "@/shared/ui/menuModel";
import { usePaletteShortcut } from "@/features/commands/usePaletteShortcut";
import { Layout } from "./Layout";

// Before the first render, so it runs ahead of every feature's own shortcut listener.
installPaletteGuard();
installNavHistory();
installSessionReaper();
installContextMenuGuard();

export default function App() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  usePaletteShortcut(() => setPaletteOpen((open) => !open));
  useEffect(() => onCommand(OPEN_PALETTE, () => setPaletteOpen(true)), []);
  useAgentEvents();

  return (
    <>
      <Layout />
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </>
  );
}
