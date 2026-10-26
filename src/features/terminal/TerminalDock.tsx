import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";
import { onCommand, TOGGLE_TERMINAL } from "@/features/commands/events";
import { createDockController } from "./dockController";
import { useTerminalStore } from "./store";

// xterm and the terminal UI load on first open, never in the entry chunk.
const TerminalPanel = lazy(() => import("./TerminalPanel"));

// The app has one terminal dock, so its imperative controller is a module singleton.
const { setPanel, setSection, noteSize, hide, toggle, onKeyDown } = createDockController();

/**
 * Wraps the chat + editor area in a vertical group with a collapsible terminal panel
 * below it. Owns the toggle (Ctrl+`, palette), the new-tab shortcut and focus hand-off.
 */
export function TerminalDock({ children }: { children: ReactNode }) {
  const open = useTerminalStore((s) => s.open);
  const [loaded, setLoaded] = useState(open);
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({ id: "xora-terminal-dock" });

  // Mount the lazy panel the first time it opens, then keep it (and its shells) alive.
  if (open && !loaded) setLoaded(true);

  useEffect(() => onCommand(TOGGLE_TERMINAL, toggle), []);

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return (
    <Group
      id="xora-terminal-dock"
      orientation="vertical"
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
      className="h-full"
    >
      <Panel id="center" minSize="25%">
        {children}
      </Panel>
      <Separator
        aria-label="Terminal yüksekliği"
        className="h-px bg-border transition-colors duration-150 data-[separator=active]:bg-fg-muted data-[separator=focus]:bg-fg-subtle data-[separator=hover]:bg-fg-subtle"
      />
      <Panel
        id="terminal"
        panelRef={setPanel}
        collapsible
        defaultSize="0%"
        minSize={120}
        onResize={noteSize}
        className="bg-black/55 backdrop-blur-xl"
      >
        <div ref={setSection} className="h-full">
          {loaded && (
            <Suspense fallback={null}>
              <TerminalPanel onHide={hide} />
            </Suspense>
          )}
        </div>
      </Panel>
    </Group>
  );
}
