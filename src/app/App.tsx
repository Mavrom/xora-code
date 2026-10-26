import { useState } from "react";
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

  return (
    <>
      <Wallpaper />
      <Layout />
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </>
  );
}
