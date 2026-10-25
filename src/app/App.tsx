import { useState } from "react";
import { CommandPalette } from "@/features/commands/CommandPalette";
import { usePaletteShortcut } from "@/features/commands/usePaletteShortcut";
import { Layout } from "./Layout";

export default function App() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  usePaletteShortcut(() => setPaletteOpen((open) => !open));

  return (
    <>
      <Layout />
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </>
  );
}
