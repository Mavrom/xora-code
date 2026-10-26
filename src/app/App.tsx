import { useState } from "react";
import { useAgentEvents } from "@/features/agents/useAgentEvents";
import { CommandPalette } from "@/features/commands/CommandPalette";
import { installPaletteGuard } from "@/features/commands/paletteGuard";
import { usePaletteShortcut } from "@/features/commands/usePaletteShortcut";
import { Layout } from "./Layout";
import { Wallpaper } from "./Wallpaper";

// Before the first render, so it runs ahead of every feature's own shortcut listener.
installPaletteGuard();

export default function App() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  usePaletteShortcut(() => setPaletteOpen((open) => !open));
  useAgentEvents();

  return (
    <>
      <Wallpaper />
      <Layout />
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </>
  );
}
