import type { ReducedMotion } from "./types";

/** `data-motion` on <html>: "reduce" forces calm motion, "full" ignores the OS setting. */
export function motionAttribute(pref: ReducedMotion): "reduce" | "full" | null {
  if (pref === "always") return "reduce";
  if (pref === "never") return "full";
  return null;
}

/** Applies the preference to the document; `globals.css` reads `data-motion`. */
export function applyMotion(pref: ReducedMotion, root: HTMLElement = document.documentElement) {
  const value = motionAttribute(pref);
  if (value) root.dataset.motion = value;
  else delete root.dataset.motion;
}
