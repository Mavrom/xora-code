import { useEffect, useLayoutEffect, useRef } from "react";
import { useWorkspaceStore } from "@/features/workspace/store";
import { getSession, sessionFor } from "./session";
import { useTerminalStore } from "./store";

interface TerminalViewProps {
  tabKey: number;
  active: boolean;
  /** Called when the shell exits cleanly, so the tab can close itself. */
  onCleanExit: (key: number) => void;
}

/** Hosts one tab's terminal. The session itself outlives this component. */
export function TerminalView({ tabKey, active, onCleanExit }: TerminalViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const focusPending = useTerminalStore((s) => s.focusPending);
  const exitHandler = useRef(onCleanExit);
  useEffect(() => {
    exitHandler.current = onCleanExit;
  });

  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const { update } = useTerminalStore.getState();
    const session = sessionFor(tabKey, useWorkspaceStore.getState().root, {
      onStarted: (shell) => update(tabKey, { shell, status: "running" }),
      onExit: (code) => {
        update(tabKey, { status: "exited", exitCode: code });
        if (code === 0) exitHandler.current(tabKey);
      },
      onFailed: () => update(tabKey, { status: "failed" }),
    });
    session.attach(el);

    // Refit on every size change (panel drag, window resize), at most once per frame.
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => session.fit());
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [tabKey]);

  // A tab that was hidden has the wrong size; fit as soon as it shows again.
  useEffect(() => {
    if (!active) return;
    const frame = requestAnimationFrame(() => getSession(tabKey)?.fit());
    return () => cancelAnimationFrame(frame);
  }, [active, tabKey]);

  useEffect(() => {
    if (!active || !focusPending) return;
    const frame = requestAnimationFrame(() => {
      getSession(tabKey)?.focus();
      useTerminalStore.getState().clearFocusRequest();
    });
    return () => cancelAnimationFrame(frame);
  }, [active, focusPending, tabKey]);

  return (
    <div
      ref={container}
      role="tabpanel"
      hidden={!active}
      className="absolute inset-0 overflow-hidden"
    />
  );
}
