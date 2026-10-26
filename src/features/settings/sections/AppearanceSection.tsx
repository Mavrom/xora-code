import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { ArrowUp, ImagePlus, Trash2 } from "lucide-react";
import { BackdropCanvas } from "@/features/backdrop/BackdropCanvas";
import { Button } from "@/shared/ui/Button";
import { Segmented } from "../controls/Segmented";
import { SectionHeader, SettingGroup, SettingRow } from "../controls/SettingRow";
import { Slider } from "../controls/Slider";
import { settingsIpc } from "../ipc";
import { useSettingsStore } from "../store";
import { DIM_RANGE, type AppearanceSettings, type BackgroundEffect } from "../types";
import { fileName, WALLPAPER_EXTENSIONS, wallpaperSrc } from "../wallpaper";

const EFFECTS: { value: BackgroundEffect; label: string }[] = [
  { value: "none", label: "Yok" },
  { value: "dither", label: "Dither" },
  { value: "ascii", label: "ASCII" },
  { value: "halftone", label: "Halftone" },
  { value: "scanlines", label: "Tarama" },
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
      title: "Duvar kağıdı seç",
      multiple: false,
      directory: false,
      filters: [{ name: "Görseller", extensions: WALLPAPER_EXTENSIONS }],
    }).catch(() => null);
    if (typeof chosen !== "string") return;
    setBusy(true);
    try {
      set({ wallpaper: await settingsIpc.importWallpaper(chosen) });
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    setError(null);
    set({ wallpaper: null });
    settingsIpc.removeWallpaper().catch(() => {
      // The setting is already cleared; a leftover file is replaced by the next import.
    });
  };

  return (
    <>
      <SectionHeader
        title="Görünüm"
        description="Yeni sohbet ekranının üstüne kendi görselinizi koyun; composer'ın altında onyx'e karışır. Görsel yokken Xora saf onyx kalır."
      />

      <AppearancePreview appearance={appearance} busy={busy} onPick={() => void pick()} />

      <div className="mt-3 flex min-h-7 items-center justify-between gap-3">
        <p
          className="min-w-0 truncate text-xs text-fg-subtle"
          title={appearance.wallpaper ?? undefined}
        >
          {hasWallpaper
            ? fileName(appearance.wallpaper ?? "")
            : "PNG, JPG, WebP, GIF, AVIF ya da BMP · en fazla 40 MB"}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          {hasWallpaper && (
            <Button variant="ghost" icon={Trash2} onClick={remove} disabled={busy}>
              Kaldır
            </Button>
          )}
          <Button
            variant={hasWallpaper ? "secondary" : "primary"}
            icon={ImagePlus}
            onClick={() => void pick()}
            disabled={busy}
          >
            {busy ? "Ekleniyor…" : hasWallpaper ? "Değiştir…" : "Görsel seç…"}
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          Görsel eklenemedi: {error}
        </p>
      )}

      <SettingGroup title="Görsel">
        <SettingRow
          label="Efekt"
          description="Görseli dither, ASCII, halftone ya da tarama çizgileriyle yeniden çizer."
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
          label="Karartma"
          description="Parlak görsellerde composer'ın öne çıkması için görseli koyulaştırır."
          control={(id) => (
            <Slider
              labelledBy={id}
              value={appearance.dim}
              min={DIM_RANGE.min}
              max={DIM_RANGE.max}
              format={percent}
              disabled={!hasWallpaper}
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
  const src = wallpaperSrc(appearance.wallpaper);
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = src !== null && failed !== src;

  return (
    <figure
      aria-label="Görünüm önizlemesi"
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
              {src && failed === src ? "Görsel açılamadı, yenisini seçin" : "Görsel seçin"}
            </span>
          </button>
        )}
      </div>
    </figure>
  );
}
