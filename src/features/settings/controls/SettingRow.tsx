import { useId, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/shared/ui/cn";
import { isModified, resetPatch, type SettingPath } from "../settingPath";
import { useSettingsStore } from "../store";
import { t } from "@/shared/i18n";

interface SettingGroupProps {
  title?: string;
  /** Right side of the group header (e.g. a refresh button). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** For groups that are one setting (a custom picker): where the settings search lands. */
  setting?: SettingPath;
}

/** A titled card of setting rows separated by hairlines. */
export function SettingGroup({ title, action, children, className, setting }: SettingGroupProps) {
  return (
    <section data-setting={setting} className={cn("mt-8 rounded-lg", className)}>
      {(title || action) && (
        <div className="mb-2 flex h-6 items-center justify-between px-1">
          {title && (
            <h3 className="text-2xs font-medium tracking-[0.06em] text-fg-subtle uppercase">
              {title}
            </h3>
          )}
          {action}
        </div>
      )}
      <div className="bg-surface divide-y divide-border overflow-visible rounded-lg border border-border">
        {children}
      </div>
    </section>
  );
}

interface SettingRowProps {
  label: string;
  description?: ReactNode;
  /** Renders the control; receives the label id for `aria-labelledby`. */
  control: (labelId: string) => ReactNode;
  /** Stack the control under the text (wide controls). */
  stacked?: boolean;
  /**
   * The stored setting this row edits: marks the row when it differs from the default,
   * offers a reset, and is where the settings search lands.
   */
  setting?: SettingPath;
}

/** Label and description on the left, the control on the right. */
export function SettingRow({ label, description, control, stacked, setting }: SettingRowProps) {
  const labelId = useId();
  const modified = useSettingsStore((s) => (setting ? isModified(s.settings, setting) : false));
  return (
    <div
      data-setting={setting}
      className={cn(
        "group/row flex min-h-14 gap-6 px-4 py-3 first:rounded-t-lg last:rounded-b-lg",
        stacked ? "flex-col items-stretch gap-3" : "items-center justify-between",
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <div id={labelId} className="text-ui text-fg">
            {label}
          </div>
          {modified && setting && (
            <button
              type="button"
              title={t("Reset to default")}
              aria-label={t("{label}: reset to default", { label })}
              onClick={() => useSettingsStore.getState().update(resetPatch(setting))}
              className="group/reset inline-flex h-5 items-center gap-1 rounded-md px-1 text-fg-subtle transition-colors duration-fast hover:bg-hover hover:text-fg"
            >
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-fg-muted group-hover/reset:hidden"
              />
              <RotateCcw
                size={11}
                strokeWidth={2}
                aria-hidden
                className="hidden group-hover/reset:block"
              />
            </button>
          )}
        </div>
        {description && <p className="mt-0.5 text-xs text-pretty text-fg-muted">{description}</p>}
      </div>
      {control(labelId)}
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  description: ReactNode;
  action?: ReactNode;
}

/** Big section title with a one-line explanation, like Linear's settings pages. */
export function SectionHeader({ title, description, action }: SectionHeaderProps) {
  return (
    <header className="flex items-end justify-between gap-6 border-b border-border pb-6">
      <div className="min-w-0">
        <h2 className="text-title font-semibold text-fg">{title}</h2>
        <p className="mt-1.5 max-w-[52ch] text-ui text-pretty text-fg-muted">{description}</p>
      </div>
      {action}
    </header>
  );
}
