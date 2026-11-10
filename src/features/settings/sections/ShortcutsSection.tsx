import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Search } from "lucide-react";
import { COMMANDS } from "@/features/commands/registry";
import { actionDef, type BindableId } from "@/features/keymap/actions";
import { formatBinding, parseBinding } from "@/features/keymap/binding";
import { captureStep, findConflict, refusal, samePress } from "@/features/keymap/capture";
import { beginCapture } from "@/features/keymap/captureGuard";
import { defaultBindings, PLATFORM, useKeymap } from "@/features/keymap/keymap";
import { resetAllBindings, resetBinding, saveBindings } from "@/features/keymap/settingsSync";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/ui/cn";
import { confirmDialog } from "@/shared/ui/confirm";
import { Kbd } from "@/shared/ui/Kbd";
import { describeShortcut } from "@/shared/ui/keys";
import { ResetButton } from "../controls/ResetButton";
import { SectionHeader, SettingGroup } from "../controls/SettingRow";
import { groupShortcuts, shortcutSources, type ShortcutSource } from "../shortcuts";
import { t } from "@/shared/i18n";
import { devShortcutsSeed } from "./shortcutsFixture";

/** The row being edited: recording keys, or holding a binding another action already has. */
export type ShortcutEdit =
  | { id: BindableId; phase: "capture"; message?: string }
  | { id: BindableId; phase: "conflict"; binding: string; other: BindableId };

const label = (shortcut: string) => describeShortcut(shortcut, PLATFORM);

export function ShortcutsSection() {
  const [query, setQuery] = useState("");
  const overrides = useKeymap((s) => s.overrides);
  const [edit, setEdit] = useState<ShortcutEdit | null>(devShortcutsSeed);
  const rows = useMemo(() => shortcutSources(COMMANDS, overrides), [overrides]);
  const groups = useMemo(() => groupShortcuts(rows, query, label), [rows, query]);
  const titles = useMemo(() => new Map(rows.map((r) => [r.id, r.title])), [rows]);
  const anyModified = rows.some((r) => r.modified);

  const resetAll = async () => {
    const choice = await confirmDialog({
      title: t("Reset all shortcuts?"),
      message: t("Every shortcut goes back to its default."),
      confirmLabel: t("Reset all"),
      discardLabel: null,
    });
    if (choice !== "save") return;
    setEdit(null);
    resetAllBindings();
  };

  return (
    <>
      <SectionHeader
        title={t("Shortcuts")}
        description={t(
          "Every command in the command palette and its keyboard shortcut. Click a shortcut to change it.",
        )}
        action={
          <Button
            variant="ghost"
            icon={RotateCcw}
            disabled={!anyModified}
            onClick={() => void resetAll()}
          >
            {t("Reset all shortcuts")}
          </Button>
        }
      />

      <label className="mt-8 flex h-9 items-center gap-2.5 rounded-md border border-border-strong bg-elevated px-3 transition-[border-color,box-shadow] duration-base focus-within:border-fg-subtle/60 focus-within:shadow-halo">
        <Search size={14} strokeWidth={1.75} className="shrink-0 text-fg-subtle" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Search commands or keys…")}
          aria-label={t("Search shortcuts")}
          spellCheck={false}
          className="h-full min-w-0 flex-1 bg-transparent text-ui text-fg outline-none placeholder:text-fg-subtle focus-visible:outline-none"
        />
      </label>

      {groups.length === 0 ? (
        <p className="py-10 text-center text-ui text-fg-muted">
          {t("No command matches “{query}”.", { query: query.trim() })}
        </p>
      ) : (
        groups.map((group) => (
          <SettingGroup key={group.group} title={group.group}>
            {group.items.map((item) => (
              <ShortcutRow
                key={item.id}
                item={item}
                edit={item.action && edit?.id === item.action ? edit : null}
                otherTitle={(id) => titles.get(id) ?? id}
                onEdit={setEdit}
              />
            ))}
          </SettingGroup>
        ))
      )}
    </>
  );
}

interface ShortcutRowProps {
  item: ShortcutSource;
  edit: ShortcutEdit | null;
  otherTitle: (id: BindableId) => string;
  onEdit: (edit: ShortcutEdit | null) => void;
}

/** What a recorded binding does: refused, held for a conflict, or saved. */
function settle(id: BindableId, text: string): ShortcutEdit | null {
  const binding = parseBinding(text);
  if (!binding) return null;
  const reason = refusal(binding, actionDef(id).scope, PLATFORM);
  if (reason) return { id, phase: "capture", message: reason };
  const defaults = defaultBindings(id);
  if (defaults.length === 1 && samePress(binding, defaults[0], PLATFORM)) {
    resetBinding(id);
    return null;
  }
  const other = findConflict(id, binding, useKeymap.getState().overrides, PLATFORM);
  if (other) return { id, phase: "conflict", binding: text, other };
  saveBindings({ [id]: text });
  return null;
}

function ShortcutRow({ item, edit, otherTitle, onEdit }: ShortcutRowProps) {
  const button = useRef<HTMLButtonElement>(null);
  const action = item.action;
  const capturing = edit?.phase === "capture";

  // Recording: every key press goes to this row (the guard keeps global shortcuts quiet).
  useEffect(() => {
    if (!capturing || !action) return;
    // Set once a key press ended the recording: the guard then stays until that key is
    // released, so its auto-repeat does not fire the shortcut just recorded.
    let settledByKey = false;
    const end = beginCapture((e) => {
      if (settledByKey) return;
      if (e.key === "Tab" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Focus moves on (the guard lets Tab through); recording stops with it.
        onEdit(null);
        return;
      }
      const step = captureStep(e, PLATFORM);
      if (step.kind === "wait") return;
      if (step.kind === "refused") {
        onEdit({ id: action, phase: "capture", message: step.reason });
        return;
      }
      const next = step.kind === "binding" ? settle(action, formatBinding(step.binding)) : null;
      if (next?.phase === "capture") {
        onEdit(next);
        return;
      }
      if (step.kind === "clear") saveBindings({ [action]: null });
      settledByKey = true;
      onEdit(next);
    });
    return () => {
      if (!settledByKey) return end();
      const release = () => {
        window.removeEventListener("keyup", release, true);
        window.removeEventListener("blur", release);
        end();
      };
      window.addEventListener("keyup", release, true);
      window.addEventListener("blur", release);
    };
  }, [capturing, action, onEdit]);

  const finishConflict = (reassign: boolean) => {
    if (edit?.phase !== "conflict") return;
    if (reassign) saveBindings({ [edit.id]: edit.binding, [edit.other]: null });
    onEdit(null);
    button.current?.focus();
  };

  const hint =
    edit?.phase === "capture"
      ? (edit.message ?? t("Esc cancels, Backspace removes the shortcut."))
      : null;

  return (
    <div className="px-4 py-2" data-shortcut={item.id}>
      <div className="flex min-h-7 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-ui text-fg-muted">{item.title}</span>
          {item.modified && action && (
            <ResetButton
              label={item.title}
              onReset={() => {
                onEdit(null);
                resetBinding(action);
              }}
            />
          )}
        </div>
        {action ? (
          <button
            ref={button}
            type="button"
            aria-label={
              item.shortcuts.length > 0
                ? t("{title}: {keys}. Change shortcut", {
                    title: item.title,
                    keys: item.shortcuts.map(label).join(", "),
                  })
                : t("{title}: no shortcut. Set shortcut", { title: item.title })
            }
            aria-describedby={hint ? `${item.id}-hint` : undefined}
            onClick={() => onEdit(capturing ? null : { id: action, phase: "capture" })}
            onBlur={() => {
              if (capturing) onEdit(null);
            }}
            className={cn(
              "flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-1.5 transition-colors duration-fast",
              capturing ? "border-border-strong bg-elevated" : "border-transparent hover:bg-hover",
            )}
          >
            {capturing ? (
              <span className="px-0.5 text-xs text-fg-muted">{t("Press keys…")}</span>
            ) : (
              <Bindings shortcuts={item.shortcuts} />
            )}
          </button>
        ) : (
          <span className="pr-1.5 text-2xs text-fg-subtle">{t("Unassigned")}</span>
        )}
      </div>
      {hint && (
        <p
          id={`${item.id}-hint`}
          aria-live="polite"
          className={cn(
            "mt-1 text-right text-2xs",
            edit?.phase === "capture" && edit.message ? "text-fg" : "text-fg-subtle",
          )}
        >
          {hint}
        </p>
      )}
      {edit?.phase === "conflict" && (
        <div
          role="alert"
          className="mt-1.5 flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5 text-2xs text-fg-muted"
        >
          <span className="flex items-center gap-1.5">
            <Kbd keys={edit.binding} />
            {t("Already used by: {title}", { title: otherTitle(edit.other) })}
          </span>
          <span className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => finishConflict(false)}>
              {t("Cancel")}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => finishConflict(true)}>
              {t("Reassign")}
            </Button>
          </span>
        </div>
      )}
    </div>
  );
}

function Bindings({ shortcuts }: { shortcuts: string[] }) {
  if (shortcuts.length === 0) {
    return <span className="px-0.5 text-2xs text-fg-subtle">{t("Unassigned")}</span>;
  }
  return shortcuts.map((shortcut, index) => (
    <span key={shortcut} className="flex items-center gap-1.5">
      {index > 0 && <span className="text-2xs text-fg-subtle">/</span>}
      <Kbd keys={shortcut} />
    </span>
  ));
}
