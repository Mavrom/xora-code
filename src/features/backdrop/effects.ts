// Pure pixel work behind the new-chat backdrop: each effect redraws the picture on a
// canvas from a downscaled copy, so even a large wallpaper costs a few milliseconds.
import type { BackgroundEffect } from "@/features/settings/types";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Source rectangle that fills `dstW` x `dstH` like `object-fit: cover`. `focusY` (0-1)
 * picks which part of a tall picture stays: 0.35 keeps faces, which sit above centre.
 */
export function coverRect(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  focusY = 0.5,
): Rect {
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const w = dstW / scale;
  const h = dstH / scale;
  return { x: (srcW - w) / 2, y: (srcH - h) * focusY, w, h };
}

/** Perceived brightness, 0-1. */
export const luminance = (r: number, g: number, b: number) =>
  (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/**
 * How strongly a cell should be marked: luminance blended with the strongest channel, so
 * saturated colours (red eyes, petals) count as bright even though red weighs little in
 * luminance.
 */
export const markStrength = (r: number, g: number, b: number) =>
  0.5 * luminance(r, g, b) + (0.5 * Math.max(r, g, b)) / 255;

/** 8x8 Bayer threshold matrix, values 0-63. */
export const BAYER_8: readonly number[] = (() => {
  const out: number[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      let v = 0;
      // Interleave the bits of x ^ y and y, lowest bit first into the highest place
      // (bit reversal is what spreads neighbouring thresholds far apart).
      for (let bit = 0; bit < 3; bit++) {
        const xb = (x >> bit) & 1;
        const yb = (y >> bit) & 1;
        v = (v << 2) | ((xb ^ yb) << 1) | yb;
      }
      out.push(v);
    }
  }
  return out;
})();

/**
 * Ordered dot dithering in place. Each pixel is either lit, in its own colour pushed
 * brighter, or black; the Bayer matrix spreads the lit ones so their density follows
 * the picture's brightness. Colours then snap to `levels` steps per channel, which
 * gives the printed, few-inks look.
 */
export function ditherPixels(data: Uint8ClampedArray, width: number, levels = 6) {
  const step = 255 / (levels - 1);
  const snap = (v: number) => Math.min(levels - 1, Math.max(0, Math.round(v / step))) * step;
  for (let i = 0; i < data.length; i += 4) {
    const p = i / 4;
    const t = (BAYER_8[((Math.floor(p / width) & 7) << 3) | ((p % width) & 7)] + 0.5) / 64;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Share of lit pixels; a lit one carries 1/share of the colour so the area keeps its tone.
    const share = Math.min(1, luminance(r, g, b) * 1.3);
    const lit = share > t;
    const gain = lit ? 1 / Math.max(0.35, share) : 0;
    data[i] = snap(r * gain);
    data[i + 1] = snap(g * gain);
    data[i + 2] = snap(b * gain);
  }
}

/** Dark to bright; a space for the darkest cells keeps the background black. */
export const ASCII_RAMP = " .:-=+*#%@";

export function asciiChar(lum: number): string {
  const i = Math.round(Math.min(1, Math.max(0, lum)) * (ASCII_RAMP.length - 1));
  return ASCII_RAMP[i];
}

/**
 * Brightness range of a picture: the 2nd and 97th percentile of its luminance. Dark
 * pictures span only a sliver of 0-1; stretching that sliver keeps faces and shadows
 * from vanishing into blank cells.
 */
export function toneRange(data: Uint8ClampedArray): [number, number] {
  const bins = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    bins[Math.round(markStrength(data[i], data[i + 1], data[i + 2]) * 255)]++;
  }
  const total = data.length / 4;
  const at = (share: number) => {
    let seen = 0;
    for (let v = 0; v < 256; v++) {
      seen += bins[v];
      if (seen >= total * share) return v / 255;
    }
    return 1;
  };
  const lo = at(0.02);
  const hi = Math.max(at(0.97), lo + 0.1);
  return [lo, Math.min(1, hi)];
}

/** Luminance stretched to the picture's own range, lifted slightly (gamma) for small marks. */
export const stretch = (lum: number, [lo, hi]: [number, number]) =>
  Math.pow(Math.min(1, Math.max(0, (lum - lo) / (hi - lo))), 0.6);

/**
 * Colour of a mark: the cell's hue at full strength, dimmed by its stretched brightness.
 * A tiny character or dot on black reads much darker than the area it stands for.
 */
export function markColor(r: number, g: number, b: number, level: number): string {
  const peak = Math.max(r, g, b, 1);
  const k = ((0.45 + 0.55 * level) * 255) / peak;
  return `rgb(${Math.round(r * k)} ${Math.round(g * k)} ${Math.round(b * k)})`;
}

/** Halftone dot radius for a cell: brighter cells get bigger dots, never past the cell. */
export const dotRadius = (lum: number, cell: number) =>
  (Math.sqrt(Math.min(1, Math.max(0, lum))) * cell) / 1.85;

/** Size in CSS px of one effect cell (a dither pixel, a dot, a character). */
export const CELL: Record<Exclude<BackgroundEffect, "none" | "scanlines">, number> = {
  dither: 2,
  halftone: 6,
  ascii: 8,
};

/** Draws `image` into a fresh `cols` x `rows` canvas (smoothing averages each cell). */
function sample(image: CanvasImageSource, src: Rect, cols: number, rows: number) {
  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, src.x, src.y, src.w, src.h, 0, 0, cols, rows);
  return { canvas, ctx, pixels: ctx.getImageData(0, 0, cols, rows) };
}

/**
 * Paints the picture with `effect` over the whole of `ctx`'s canvas, whose size is
 * `width` x `height` CSS px at `dpr` device pixels each.
 */
export function paintEffect(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource & { width: number; height: number },
  effect: BackgroundEffect,
  width: number,
  height: number,
  dpr: number,
  focusY = 0.5,
) {
  const src = coverRect(image.width, image.height, width, height, focusY);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);

  if (effect === "none" || effect === "scanlines") {
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, src.x, src.y, src.w, src.h, 0, 0, width, height);
    if (effect === "scanlines") {
      ctx.fillStyle = "rgb(0 0 0 / 0.55)";
      for (let y = 0; y < height; y += 3) ctx.fillRect(0, y + 1.5, width, 1.5);
    }
    return;
  }

  const cell = CELL[effect];
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const sampled = sample(image, src, cols, rows);
  if (!sampled) return;
  const { canvas, ctx: small, pixels } = sampled;
  const data = pixels.data;

  if (effect === "dither") {
    ditherPixels(data, cols);
    small.putImageData(pixels, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, 0, 0, cols * cell, rows * cell);
    return;
  }

  const range = toneRange(data);
  if (effect === "ascii") {
    ctx.font = `700 ${cell + 2}px "JetBrains Mono Variable", ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
  }
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = (row * cols + col) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const level = stretch(markStrength(r, g, b), range);
      ctx.fillStyle = markColor(r, g, b, level);
      const cx = col * cell + cell / 2;
      const cy = row * cell + cell / 2;
      if (effect === "halftone") {
        const radius = dotRadius(level, cell);
        if (radius < 0.3) continue;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const ch = asciiChar(level);
        if (ch !== " ") ctx.fillText(ch, cx, cy);
      }
    }
  }
}
