// While Settings > Shortcuts records a new binding, every key press belongs to the recorder:
// no global shortcut may fire (pressing Ctrl+B to bind it must not hide the sidebar).
// Same pattern as `paletteGuard.ts`: one window capture listener, installed before any other
// feature's, takes the key press and hands it to the recorder.

type Sink = (e: KeyboardEvent) => void;

let sink: Sink | null = null;

export const isCapturing = () => sink !== null;

/**
 * Sends every key press to `onKey` until the returned function is called. Tab is left alone
 * (after `onKey` saw it) so focus can still leave the row.
 */
export function beginCapture(onKey: Sink): () => void {
  sink = onKey;
  return () => {
    if (sink === onKey) sink = null;
  };
}

let installed = false;

/** Installs the listener once; call it at module load, before any component mounts. */
export function installCaptureGuard(target: Pick<Window, "addEventListener"> = window) {
  if (installed) return;
  installed = true;
  target.addEventListener(
    "keydown",
    (e) => {
      const current = sink;
      if (!current) return;
      const plainTab = e.key === "Tab" && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (!plainTab) e.preventDefault();
      e.stopImmediatePropagation();
      current(e);
    },
    true,
  );
}
