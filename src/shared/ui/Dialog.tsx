import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";
import { FOCUSABLE, nextTrapIndex } from "./focusTrap";
import { enterModal } from "./modalGuard";

interface DialogProps {
  title: string;
  /** Body copy under the title; also the dialog's accessible description. */
  description?: ReactNode;
  /** Esc, a click on the backdrop. */
  onCancel: () => void;
  /** Footer buttons, right-aligned. */
  actions: ReactNode;
  /** `alertdialog` for confirmations that interrupt the user. */
  role?: "dialog" | "alertdialog";
  className?: string;
}

/**
 * In-app modal on the same surface as the command palette. Focus moves into the dialog
 * (to the element with `data-autofocus`, else the first control), Tab is trapped inside,
 * the app behind it is inert and its shortcuts are swallowed, and focus returns to where it
 * was when the dialog closes.
 */
export function Dialog({
  title,
  description,
  onCancel,
  actions,
  role = "dialog",
  className,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const leave = enterModal();
    const root = panel.current;
    const initial =
      root?.querySelector<HTMLElement>("[data-autofocus]") ??
      root?.querySelector<HTMLElement>(FOCUSABLE);
    (initial ?? root)?.focus({ preventScroll: true });
    return () => {
      leave();
      // The opener may be gone (e.g. its tab closed); then whoever handles that moves focus.
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  // Esc and Tab are handled on the document so they work even if focus slipped to <body>.
  const cancel = useRef(onCancel);
  useEffect(() => {
    cancel.current = onCancel;
  });
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const root = panel.current;
      if (!root) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancel.current();
      } else if (e.key === "Tab") {
        const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
        const index = items.indexOf(document.activeElement as HTMLElement);
        const next = items[nextTrapIndex(index, items.length, e.shiftKey)];
        e.preventDefault();
        next?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[22vh] transition-opacity duration-150 ease-out-quint starting:opacity-0"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={panel}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "w-full max-w-[420px] rounded-lg border border-border-strong bg-surface shadow-2xl shadow-black/70 outline-none",
          "transition-[opacity,scale,translate] duration-150 ease-out-quint starting:translate-y-1 starting:scale-[.98] starting:opacity-0",
          className,
        )}
      >
        <div className="px-5 pt-5 pb-4">
          <h2 id={titleId} className="text-ui font-medium text-fg">
            {title}
          </h2>
          {description && (
            <div id={descriptionId} className="mt-1.5 text-xs leading-relaxed text-fg-muted">
              {description}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          {actions}
        </div>
      </div>
    </div>,
    document.body,
  );
}
