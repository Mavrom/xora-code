import { useState, type CSSProperties } from "react";
import { cn } from "@/shared/ui/cn";
import { blurScale } from "./glass";

interface WallpaperImageProps {
  src: string;
  blur: number;
  dim: number;
  onError?: () => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * The picture, blurred and darkened, filling its box like `background-size: cover`.
 * Fades in once decoded so a slow disk never flashes a half-drawn image.
 */
export function WallpaperImage({ src, blur, dim, onError, className, style }: WallpaperImageProps) {
  const [loaded, setLoaded] = useState<string | null>(null);
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none overflow-hidden bg-bg", className)}
      style={style}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        decoding="async"
        onLoad={() => setLoaded(src)}
        onError={onError}
        className="size-full object-cover transition-[opacity,filter] duration-slow ease-out-quint"
        style={{
          opacity: loaded === src ? 1 : 0,
          filter: blur > 0 ? `blur(${blur}px)` : undefined,
          scale: String(blurScale(blur)),
        }}
      />
      <div
        className="absolute inset-0 bg-black transition-opacity duration-base"
        style={{ opacity: Math.min(100, Math.max(0, dim)) / 100 }}
      />
    </div>
  );
}
