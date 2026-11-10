import { ArrowUpRight, X } from "lucide-react";
import { useSettingsStore } from "@/features/settings/store";
import { t } from "@/shared/i18n";
import { selectNotice, useUpdateStore } from "./store";
import { openRelease } from "./updateCheck";

/** The sidebar's quiet "a newer version is out" line, above the account card. */
export function UpdateNotice() {
  const release = useUpdateStore(selectNotice);
  const enabled = useSettingsStore((s) => s.settings.general.checkForUpdates);
  if (!release || !enabled) return null;

  return (
    <div className="mb-1 flex h-8 items-center gap-1 rounded-lg pr-1 pl-2.5 transition-opacity duration-base starting:opacity-0">
      <span className="min-w-0 flex-1 truncate text-[11px] text-fg-muted">
        {t("Version {version} is available", { version: release.version })}
      </span>
      <button
        type="button"
        onClick={() => openRelease(release.url)}
        className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-fg transition-colors duration-fast hover:bg-white/[0.05]"
      >
        {t("View release")}
        <ArrowUpRight size={12} strokeWidth={1.75} aria-hidden className="text-fg-subtle" />
      </button>
      <button
        type="button"
        aria-label={t("Dismiss")}
        title={t("Dismiss")}
        onClick={() => useUpdateStore.getState().dismiss(release.version)}
        className="grid size-6 shrink-0 place-items-center rounded-md text-fg-subtle transition-colors duration-fast hover:bg-white/[0.05] hover:text-fg"
      >
        <X size={13} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}
