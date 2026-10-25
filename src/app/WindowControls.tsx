import { Copy, Minus, Square, X, type LucideIcon } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { cn } from "@/shared/ui/cn";
import { useIsMaximized } from "./useWindowState";

type WindowAction = "minimize" | "toggleMaximize" | "close";

function run(action: WindowAction) {
  const win = getCurrentWindow();
  const task =
    action === "minimize"
      ? win.minimize()
      : action === "close"
        ? win.close()
        : win.toggleMaximize();
  task.catch((error: unknown) => console.error(`Window ${action} failed`, error));
}

interface CaptionButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

/** Windows-style caption button: 46px wide, full bar height, flat hover. */
function CaptionButton({ icon: Icon, label, onClick, danger }: CaptionButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      tabIndex={-1}
      onClick={onClick}
      className={cn(
        "inline-flex h-full w-[46px] items-center justify-center text-fg-muted transition-colors duration-150",
        danger
          ? "hover:bg-danger hover:text-fg active:opacity-80"
          : "hover:bg-hover hover:text-fg active:bg-elevated",
      )}
    >
      <Icon size={14} strokeWidth={1.25} aria-hidden />
    </button>
  );
}

export function WindowControls() {
  const maximized = useIsMaximized();

  return (
    <div className="flex h-full items-stretch">
      <CaptionButton icon={Minus} label="Simge durumuna küçült" onClick={() => run("minimize")} />
      <CaptionButton
        icon={maximized ? Copy : Square}
        label={maximized ? "Önceki boyuta getir" : "Ekranı kapla"}
        onClick={() => run("toggleMaximize")}
      />
      <CaptionButton icon={X} label="Kapat" danger onClick={() => run("close")} />
    </div>
  );
}
