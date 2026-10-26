import { useEffect, useRef, useState } from "react";
import { FrostedGround } from "@/features/backdrop/FrostedGround";
import { FileTree } from "@/features/files/FileTree";
import { openFolder } from "@/features/workspace/openFolder";
import { cn } from "@/shared/ui/cn";
import { useUiStore } from "./uiStore";

/** Grace period before a drawer the pointer left slides away (crossing a gap, overshoot). */
const CLOSE_DELAY_MS = 300;

/**
 * The file tree, tucked against the sidebar's edge. A thin strip there opens it on hover
 * and it slides away once the pointer leaves; pinned (title bar button, Ctrl+Shift+E) it
 * stays. Always mounted: the tree also runs the workspace lifecycle.
 */
export function FilesDrawer() {
  const pinned = useUiStore((s) => s.filesOpen);
  const [hovered, setHovered] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const open = pinned || hovered;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const enter = () => {
    window.clearTimeout(timer.current);
    setHovered(true);
  };
  const leave = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setHovered(false), CLOSE_DELAY_MS);
  };

  return (
    <div
      onMouseEnter={enter}
      onMouseLeave={leave}
      className={cn("absolute inset-y-0 left-0 z-30", open ? "w-[17rem]" : "w-2.5")}
    >
      {/* Handle: tells the edge strip apart while the drawer is away. */}
      <div
        aria-hidden
        className={cn(
          "absolute top-1/2 left-1 h-12 w-1 -translate-y-1/2 rounded-full bg-white/15 transition-opacity duration-base",
          open ? "opacity-0" : "opacity-100",
        )}
      />
      <aside
        aria-label="Dosyalar"
        inert={!open}
        className={cn(
          "absolute inset-y-0 left-0 w-[17rem] py-2 pl-2 transition-[translate,opacity] duration-base ease-out-quint",
          open ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-4 opacity-0",
        )}
      >
        <div className="relative isolate h-full overflow-hidden rounded-xl border border-white/[0.09] bg-black/35 backdrop-saturate-150 shadow-[0_12px_40px_rgb(0_0_0/0.5),inset_0_1px_0_rgb(255_255_255/0.04)] backdrop-blur-2xl">
          <FrostedGround />
          <FileTree onOpenFolder={openFolder} />
        </div>
      </aside>
    </div>
  );
}
