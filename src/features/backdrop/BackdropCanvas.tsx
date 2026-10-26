import { useEffect, useRef, useState } from "react";
import type { BackgroundEffect } from "@/features/settings/types";
import { cn } from "@/shared/ui/cn";
import { paintEffect } from "./effects";

/** Resizes repaint once the window settles, not on every frame of a drag. */
const RESIZE_SETTLE_MS = 120;

interface BackdropCanvasProps {
  src: string;
  effect: BackgroundEffect;
  /** Darkening over the picture, 0-100. */
  dim: number;
  /** Which band of a tall picture stays in view (0 top, 1 bottom). */
  focusY?: number;
  onError?: () => void;
  className?: string;
}

/** Decodes the picture once; pixel effects need it as a bitmap the canvas may read. */
async function loadBitmap(src: string): Promise<ImageBitmap> {
  const response = await fetch(src);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return createImageBitmap(await response.blob());
}

/**
 * The wallpaper redrawn with an effect (dither, ASCII, halftone, scanlines) on a canvas
 * that fills its box. Fades in once painted, so a slow disk never flashes a half picture.
 */
export function BackdropCanvas({
  src,
  effect,
  dim,
  focusY = 0.35,
  onError,
  className,
}: BackdropCanvasProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bitmap, setBitmap] = useState<{ src: string; image: ImageBitmap } | null>(null);
  const [painted, setPainted] = useState(false);
  const errorRef = useRef(onError);
  useEffect(() => {
    errorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    let alive = true;
    loadBitmap(src)
      .then((image) => {
        if (alive) setBitmap({ src, image });
        else image.close();
      })
      .catch(() => alive && errorRef.current?.());
    return () => {
      alive = false;
    };
  }, [src]);

  useEffect(() => () => bitmap?.image.close(), [bitmap]);

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas || !bitmap || bitmap.src !== src) return;
    let timer = 0;
    const paint = () => {
      const { width, height } = box.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      paintEffect(ctx, bitmap.image, effect, width, height, dpr, focusY);
      setPainted(true);
    };
    paint();
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(paint, RESIZE_SETTLE_MS);
    });
    observer.observe(box);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [bitmap, src, effect, focusY]);

  return (
    <div ref={boxRef} aria-hidden className={cn("pointer-events-none overflow-hidden", className)}>
      <canvas
        ref={canvasRef}
        className={cn(
          "size-full transition-opacity duration-slow ease-out-quint",
          painted ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        className="absolute inset-0 bg-black transition-opacity duration-base"
        style={{ opacity: Math.min(100, Math.max(0, dim)) / 100 }}
      />
    </div>
  );
}
