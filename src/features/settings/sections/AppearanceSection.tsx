import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { ArrowUp, ImagePlus, RotateCcw } from "lucide-react";
import { BackdropCanvas } from "@/features/backdrop/BackdropCanvas";
import { Button } from "@/shared/ui/Button";
import { Segmented } from "../controls/Segmented";
import { SectionHeader, SettingGroup, SettingRow } from "../controls/SettingRow";
import { Slider } from "../controls/Slider";
import { Toggle } from "../controls/Toggle";
import { settingsIpc } from "../ipc";
import { useSettingsStore } from "../store";
import {
  DIM_RANGE,
  UI_SCALE_RANGE,
  type AppearanceSettings,
  type BackgroundEffect,
  type WindowLook,
} from "../types";
import { backdropSrc, fileName, WALLPAPER_EXTENSIONS } from "../wallpaper";
import { t } from "@/shared/i18n";

const EFFECTS: { value: BackgroundEffect; label: string }[] = [
  { value: "none", label: t("None") },
  { value: "dither", label: "Dither" },
  { value: "ascii", label: "ASCII" },
  { value: "halftone", label: "Halftone" },
  { value: "scanlines", label: t("Scanlines") },
];

const WINDOW_LOOKS: { value: WindowLook; label: string }[] = [
  { value: "solid", label: t("Solid") },
  { value: "frosted", label: t("Frosted") },
  { value: "clear", label: t("Clear") },
];

const percent = (v: number) => `${v}%`;

export function AppearanceSection() {
  const appearance = useSettingsStore((s) => s.settings.appearance);
  const update = useSettingsStore((s) => s.update);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<AppearanceSettings>) => update({ appearance: patch });
  const hasWallpaper = appearance.wallpaper !== null;

  const pick = async () => {
    setError(null);
    const chosen = await open({
      title: t("Choose a picture"),
      multiple: false,
      directory: false,
      filters: [{ name: t("Images"), extensions: WALLPAPER_EXTENSIONS }],
    }).catch(() => null);
    if (typeof chosen !== "string") return;
    setBusy(true);
    try {
      set({ wallpaper: await settingsIpc.importWallpaper(chosen), picture: true });
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  /** Back to the picture Xora ships with; the user's copy is deleted. */
  const reset = () => {
    setError(null);
    set({ wallpaper: null, picture: true });
    settingsIpc.removeWallpaper().catch(() => {
      // The setting is already cleared; a leftover file is replaced by the next import.
    });
  };

  return (
    <>
      <SectionHeader
        title={t("Appearance")}
        description={t(
          "A picture sits at the top of the new-chat screen and fades into onyx below the composer. Use your own or turn it off.",
        )}
      />

      <AppearancePreview appearance={appearance} busy={busy} onPick={() => void pick()} />

      <div className="mt-3 flex min-h-7 items-center justify-between gap-3">
        <p
          className="min-w-0 truncate text-xs text-fg-subtle"
          title={appearance.wallpaper ?? undefined}
        >
          {hasWallpaper
            ? fileName(appearance.wallpaper ?? "")
            : t("Xora's picture · your own: PNG, JPG, WebP, GIF, AVIF or BMP, up to 40 MB")}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          {hasWallpaper && (
            <Button variant="ghost" icon={RotateCcw} onClick={reset} disabled={busy}>
              {t("Back to default")}
            </Button>
          )}
          <Button variant="secondary" icon={ImagePlus} onClick={() => void pick()} disabled={busy}>
            {busy ? t("Adding…") : hasWallpaper ? t("Change…") : t("Your own picture…")}
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {t("Could not add the picture: {error}", { error })}
        </p>
      )}

      <SettingGroup title={t("Window")}>
        <SettingRow
          label={t("Interface scale")}
          setting="appearance.uiScale"
          description={t(
            "Makes the whole interface larger or smaller. Shortcut: Ctrl + / Ctrl - / Ctrl 0.",
          )}
          control={(id) => (
            <Slider
              labelledBy={id}
              value={appearance.uiScale}
              min={UI_SCALE_RANGE.min}
              max={UI_SCALE_RANGE.max}
              step={10}
              format={percent}
              onChange={(uiScale) => set({ uiScale })}
            />
          )}
        />
        <SettingRow
          label={t("Transparency")}
          setting="appearance.window"
          description={t(
            "Frosted: the apps and desktop behind show through, blurred. Clear: they show through without blur. Solid: pure onyx.",
          )}
          control={(id) => (
            <Segmented
              labelledBy={id}
              value={appearance.window}
              options={WINDOW_LOOKS}
              onChange={(window) => set({ window })}
            />
          )}
        />
        <SettingRow
          label={t("Darkness")}
          setting="appearance.tint"
          description={t("How much a see-through window is darkened, so text stays readable.")}
          control={(id) => (
            <Slider
              labelledBy={id}
              value={appearance.tint}
              min={DIM_RANGE.min}
              max={DIM_RANGE.max}
              format={percent}
              disabled={appearance.window === "solid"}
              onChange={(tint) => set({ tint })}
            />
          )}
        />
      </SettingGroup>

      <SettingGroup title={t("Image")}>
        <SettingRow
          label={t("Show picture")}
          setting="appearance.picture"
          description={t("When off, a new chat opens on plain onyx.")}
          control={(id) => (
            <Toggle
              labelledBy={id}
              checked={appearance.picture}
              onChange={(picture) => set({ picture })}
            />
          )}
        />
        <SettingRow
          label={t("Effect")}
          setting="appearance.effect"
          description={t("Redraws the picture with dither, ASCII, halftone or scanlines.")}
          control={(id) => (
            <Segmented
              labelledBy={id}
              value={appearance.effect}
              options={EFFECTS}
              onChange={(effect) => set({ effect })}
            />
          )}
        />
        <SettingRow
          label={t("Dim")}
          setting="appearance.dim"
          description={t("Darkens bright pictures so the composer stands out.")}
          control={(id) => (
            <Slider
              labelledBy={id}
              value={appearance.dim}
              min={DIM_RANGE.min}
              max={DIM_RANGE.max}
              format={percent}
              disabled={!appearance.picture}
              onChange={(dim) => set({ dim })}
            />
          )}
        />
      </SettingGroup>
    </>
  );
}

interface PreviewProps {
  appearance: AppearanceSettings;
  busy: boolean;
  onPick: () => void;
}

/**
 * A miniature of the new-chat screen: the picture with the chosen effect sinking into
 * onyx, a mock sidebar and the composer. Without a picture it is the "choose" button.
 */
function AppearancePreview({ appearance, busy, onPick }: PreviewProps) {
  const src = backdropSrc(appearance);
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = src !== null && failed !== src;

  return (
    <figure
      aria-label={t("Appearance preview")}
      className="relative mt-8 grid aspect-[16/8.5] grid-cols-[22%_minmax(0,1fr)] overflow-hidden rounded-lg border border-border bg-bg shadow-well"
    >
      <div aria-hidden className="flex flex-col gap-1.5 border-r border-border bg-surface p-3 pt-6">
        {[70, 52, 64, 40, 58].map((w, i) => (
          <span key={i} className="h-1 rounded-full bg-fg-subtle/30" style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="relative isolate">
        {showImage && (
          <BackdropCanvas
            key={src}
            src={src}
            effect={appearance.effect}
            dim={appearance.dim}
            onError={() => setFailed(src)}
            className="hero-backdrop absolute inset-x-0 top-0 h-[68%]"
          />
        )}
        <div
          aria-hidden
          className="absolute inset-x-[14%] top-[44%] flex h-[18%] items-end justify-end rounded-md border border-glass-border bg-glass-strong p-1.5 backdrop-blur-xl"
        >
          <span className="grid size-3.5 place-items-center rounded-full bg-fg text-bg">
            <ArrowUp size={9} strokeWidth={2.5} />
          </span>
        </div>
        {!showImage && (
          <button
            type="button"
            onClick={onPick}
            disabled={busy}
            className="absolute inset-x-0 top-0 flex h-[42%] flex-col items-center justify-center gap-2 text-fg-muted transition-colors duration-fast hover:text-fg focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-fg-subtle"
          >
            <span className="grid size-9 place-items-center rounded-full border border-border-strong bg-elevated shadow-well">
              <ImagePlus size={16} strokeWidth={1.75} aria-hidden />
            </span>
            <span className="text-xs font-medium">
              {src && failed === src
                ? t("Could not open the picture; choose another")
                : t("Choose a picture")}
            </span>
          </button>
        )}
      </div>
    </figure>
  );
}
