import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";
import { placeMenu, SEPARATOR, type MenuEntry, type MenuItem } from "./menuModel";

interface ContextMenuProps {
  /** Pointer position (client px); the menu flips to stay inside the window. */
  x: number;
  y: number;
  items: MenuEntry[];
  label: string;
  onClose: () => void;
}

/**
 * Xora's right-click menu: a small glass card at the pointer. Arrows move, Enter picks,
 * Esc / outside click / scroll / window blur close it.
 */
export function ContextMenu({ x, y, items, label, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const actions = items.filter((e): e is MenuItem => e !== SEPARATOR);
  const [active, setActive] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPos(placeMenu(x, y, el.offsetWidth, el.offsetHeight, window.innerWidth, window.innerHeight));
    el.focus({ preventScroll: true });
  }, [x, y]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("blur", onClose);
    window.addEventListener("resize", onClose);
    document.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("blur", onClose);
      window.removeEventListener("resize", onClose);
      document.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  const pick = (item: MenuItem) => {
    onClose();
    item.onSelect();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = actions.length - 1;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step > last ? 0 : i + step < 0 ? last : i + step));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (actions[active]) pick(actions[active]);
    } else if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
      style={{ left: pos.left, top: pos.top }}
      className="fixed z-50 min-w-48 rounded-xl border border-white/[0.08] bg-[rgb(20_20_21/0.92)] p-1 shadow-2xl shadow-black/70 backdrop-blur-2xl outline-none transition-[opacity,scale] duration-fast ease-out-quint starting:scale-95 starting:opacity-0"
    >
      {items.map((entry, index) => {
        if (entry === SEPARATOR) {
          return (
            <div key={`sep-${index}`} role="separator" className="mx-2 my-1 h-px bg-white/[0.07]" />
          );
        }
        const Icon = entry.icon;
        const i = actions.indexOf(entry);
        return (
          <button
            key={entry.label}
            type="button"
            role="menuitem"
            tabIndex={-1}
            onPointerMove={() => setActive(i)}
            onClick={() => pick(entry)}
            className={cn(
              "flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] transition-colors duration-100",
              entry.danger ? "text-red-400" : "text-fg-muted",
              i === active &&
                (entry.danger ? "bg-red-500/12 text-red-300" : "bg-white/[0.07] text-fg"),
            )}
          >
            {Icon && <Icon size={14} strokeWidth={1.75} aria-hidden />}
            {entry.label}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
