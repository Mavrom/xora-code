// The Monaco instance lives inside the lazily loaded EditorPanel. It registers a focus
// function here so other parts of the UI (the tab strip) can hand focus to the editor
// without importing Monaco.

let focusTarget: (() => void) | null = null;

/** Called by EditorPanel on mount (with its focus function) and unmount (with `null`). */
export function registerEditorFocus(target: (() => void) | null) {
  focusTarget = target;
}

/** Focuses the code editor on the next frame (after React shows the new model). */
export function focusEditorSoon() {
  requestAnimationFrame(() => focusTarget?.());
}

/** Marks the editor slot (tabs, Monaco, status bar, empty state) for focus checks. */
export const EDITOR_AREA_ATTR = "data-editor-area";

const shown = (el: Element | null): el is HTMLElement =>
  el instanceof HTMLElement && el.getClientRects().length > 0 && el.offsetWidth > 0;

/**
 * The editor panel is about to collapse (or just did): if focus is inside it, typing would
 * go into an invisible file and Ctrl+S would save it. Move focus to a visible place first:
 * the chat composer, else the file tree / Inbox composer, else just blur.
 */
export function moveFocusOutOfEditor() {
  const current = document.activeElement;
  const area = current instanceof HTMLElement ? current.closest(`[${EDITOR_AREA_ATTR}]`) : null;
  if (!area || !(current instanceof HTMLElement)) return;
  // The chat composer comes after the sidebar in document order, so walk textareas backwards.
  const candidates = [
    ...[...document.querySelectorAll("textarea")].reverse(),
    document.querySelector('[role="tree"] [role="treeitem"][tabindex="0"]'),
  ];
  const target = candidates.find(
    (el): el is HTMLElement =>
      shown(el) && !el.closest(`[${EDITOR_AREA_ATTR}]`) && !el.matches(":disabled"),
  );
  if (target) target.focus({ preventScroll: true });
  else current.blur();
}
