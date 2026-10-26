import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { ImagePlus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/ui/cn";
import { SectionHeader, SettingGroup, SettingRow } from "../controls/SettingRow";
import { Slider } from "../controls/Slider";
import { fileName, WALLPAPER_EXTENSIONS, wallpaperSrc } from "../glass";
import { settingsIpc } from "../ipc";
import { useSettingsStore } from "../store";
import {
  BLUR_RANGE,
  DEFAULT_SETTINGS,
  DIM_RANGE,
  GLASS_RANGE,
  type AppearanceSettings,
} from "../types";
import { WallpaperImage } from "../WallpaperImage";

/** The preview is about a third of the window wide, so the same blur looks stronger there. */
const PREVIEW_BLUR_RATIO = 0.4;

const percent = (v: number) => `${v}%`;
const pixels = (v: number) => `${v} px`;

export function AppearanceSection() {
  const appearance = useSettingsStore((s) => s.settings.appearance);
  const update = useSettingsStore((s) => s.update);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<AppearanceSettings>) => update({ appearance: patch });
  const hasWallpaper = appearance.wallpaper !== null;
  const defaults = DEFAULT_SETTINGS.appearance;
  const atDefaults =
    appearance.glass === defaults.glass &&
    appearance.blur === defaults.blur &&
    appearance.dim === defaults.dim;

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
        description="Arka plana kendi görselinizi koyun; paneller onun üstünde cam gibi durur. Duvar kağıdı yokken Xora saf onyx kalır."
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

      <SettingGroup
        title="Cam efekti"
        action={
          <Button
            variant="ghost"
            size="sm"
            icon={RotateCcw}
            disabled={atDefaults}
            onClick={() => set({ glass: defaults.glass, blur: defaults.blur, dim: defaults.dim })}
          >
            Varsayılan
          </Button>
        }
      >
        <SettingRow
          label="Saydamlık"
          description={
            hasWallpaper
              ? "0 saf onyx; arttıkça duvar kağıdı panellerin arkasından daha çok görünür."
              : "Önce bir duvar kağıdı seçin."
          }
          control={(id) => (
            <Slider
              labelledBy={id}
              value={appearance.glass}
              min={GLASS_RANGE.min}
              max={GLASS_RANGE.max}
              format={percent}
              disabled={!hasWallpaper}
              onChange={(glass) => set({ glass })}
            />
          )}
        />
        <SettingRow
          label="Bulanıklık"
          description="Cam arkasındaki görselin ne kadar yumuşatılacağı."
          control={(id) => (
            <Slider
              labelledBy={id}
              value={appearance.blur}
              min={BLUR_RANGE.min}
              max={BLUR_RANGE.max}
              format={pixels}
              disabled={!hasWallpaper}
              onChange={(blur) => set({ blur })}
            />
          )}
        />
        <SettingRow
          label="Karartma"
          description="Parlak görsellerde yazıların okunur kalması için görseli koyulaştırır."
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
 * A miniature of the window: the wallpaper with the live glass variables on a mock
 * sidebar and panels. Without a wallpaper it doubles as the drop-in "choose" button.
 */
function AppearancePreview({ appearance, busy, onPick }: PreviewProps) {
  const src = wallpaperSrc(appearance.wallpaper);
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = src !== null && failed !== src;

  return (
    <figure
      aria-label="Görünüm önizlemesi"
      className="relative mt-8 aspect-[16/8.5] overflow-hidden rounded-lg border border-border bg-bg shadow-well"
    >
      {showImage ? (
        <WallpaperImage
          key={src}
          src={src}
          blur={appearance.blur * PREVIEW_BLUR_RATIO}
          dim={appearance.dim}
          onError={() => setFailed(src)}
          className="absolute inset-0"
        />
      ) : (
        <div aria-hidden className="hero-glow absolute inset-0" />
      )}

      {/* Mock window. Uses the same glass utilities as the real shell. */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-5 grid grid-cols-[22px_26%_minmax(0,1fr)_30%] grid-rows-[18px_minmax(0,1fr)] overflow-hidden rounded-md border border-border shadow-2xl shadow-black/60 transition-opacity duration-slow",
          !showImage && "opacity-60",
        )}
      >
        <div className="glass-bg col-span-4 flex items-center gap-1 border-b border-border px-2">
          <span className="size-1 rounded-full bg-fg-subtle/60" />
          <span className="h-1 w-10 rounded-full bg-fg-subtle/30" />
        </div>
        <div className="glass-bg border-r border-border" />
        <div className="glass-surface flex flex-col gap-1.5 border-r border-border p-2.5">
          {[70, 52, 64, 40, 58].map((w, i) => (
            <span key={i} className="h-1 rounded-full bg-fg-subtle/30" style={{ width: `${w}%` }} />
          ))}
        </div>
        <div className="glass-bg flex flex-col justify-end gap-1.5 border-r border-border p-3">
          <span className="h-1 w-3/5 rounded-full bg-fg-subtle/30" />
          <span className="h-1 w-2/5 rounded-full bg-fg-subtle/30" />
          <span className="mt-1.5 h-4 rounded-sm border border-border-strong bg-elevated/70" />
        </div>
        <div className="glass-surface flex flex-col gap-1.5 p-2.5 font-mono">
          {[45, 72, 60, 30, 66, 50].map((w, i) => (
            <span key={i} className="h-1 rounded-full bg-fg-muted/25" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>

      {!showImage && (
        <button
          type="button"
          onClick={onPick}
          disabled={busy}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-fg-muted transition-colors duration-fast hover:text-fg focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-fg-subtle"
        >
          <span className="grid size-10 place-items-center rounded-full border border-border-strong bg-elevated shadow-well">
            <ImagePlus size={17} strokeWidth={1.75} aria-hidden />
          </span>
          <span className="text-ui font-medium">
            {src && failed === src ? "Görsel açılamadı, yenisini seçin" : "Duvar kağıdı seçin"}
          </span>
        </button>
      )}
    </figure>
  );
}
