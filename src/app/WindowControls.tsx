import { Copy, Minus, Square, X, type LucideIcon } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { cn } from "@/shared/ui/cn";
import { detectPlatform } from "@/shared/ui/keys";
import { useIsMaximized } from "./useWindowState";
import { t } from "@/shared/i18n";

/**
 * macOS keeps its native traffic lights (`titleBarStyle: Overlay`, see
 * `tauri.macos.conf.json`); elsewhere the window is frameless and draws its own buttons.
 */
export const NATIVE_CAPTION =
  detectPlatform(typeof navigator === "undefined" ? undefined : navigator) === "mac";

/** Left padding that keeps a top bar's content clear of the macOS traffic lights. */
export const TRAFFIC_LIGHT_INSET = "pl-[76px]!";

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

/** Compact caption button: full bar height, small glyph, flat hover. */
function CaptionButton({ icon: Icon, label, onClick, danger }: CaptionButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      tabIndex={-1}
      onClick={onClick}
      className={cn(
        "inline-flex h-full w-9 items-center justify-center text-fg drop-shadow-[0_1px_2px_rgb(0_0_0_/0.6)] transition-colors duration-150",
        danger
          ? "hover:bg-danger hover:text-fg active:opacity-80"
          : "hover:bg-hover hover:text-fg active:bg-elevated",
      )}
    >
      <Icon size={13} strokeWidth={1.5} aria-hidden />
    </button>
  );
}

export function WindowControls() {
  const maximized = useIsMaximized();
  if (NATIVE_CAPTION) return null;

  return (
    <div className="flex h-full items-stretch">
      <CaptionButton icon={Minus} label={t("Minimize")} onClick={() => run("minimize")} />
      <CaptionButton
        icon={maximized ? Copy : Square}
        label={maximized ? t("Restore") : t("Maximize")}
        onClick={() => run("toggleMaximize")}
      />
      <CaptionButton icon={X} label={t("Close")} danger onClick={() => run("close")} />
    </div>
  );
}
