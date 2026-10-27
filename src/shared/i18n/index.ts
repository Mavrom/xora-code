// Interface language (Settings > General > Language). gettext style: the English text is
// the message id, `TR` maps it to Turkish, and a missing entry falls back to the English.
//
//   t("New chat")                          -> "Yeni sohbet" in Turkish
//   t("Continue with {name}", { name })    -> placeholders are filled in either language
//   msg("Save")                            marks a string kept as data, translated where shown
//
// Changing the language reloads the window (see app/language.ts), so plain `t()` calls are
// enough, also in lists built when a module loads. `i18n.test.ts` checks that every
// `t("…")` / `msg("…")` in the source has a Turkish entry.
import { TR } from "./tr";

export type Lang = "en" | "tr";
export type Vars = Record<string, string | number>;

const CACHE_KEY = "xora.language";

/** The system language as one of ours: Turkish for `tr*`, English for anything else. */
export function systemLanguage(
  languages: readonly string[] = globalThis.navigator?.languages ?? [],
): Lang {
  const first = languages[0] ?? globalThis.navigator?.language ?? "";
  return first.toLowerCase().startsWith("tr") ? "tr" : "en";
}

/** The language the last run settled on: Settings load after the first render. */
function cachedLanguage(): Lang | null {
  try {
    const value = globalThis.localStorage?.getItem(CACHE_KEY);
    return value === "en" || value === "tr" ? value : null;
  } catch {
    return null;
  }
}

/** Remembers `lang` for the next start. */
export function rememberLanguage(lang: Lang): void {
  try {
    globalThis.localStorage?.setItem(CACHE_KEY, lang);
  } catch {
    // Not persisted; Settings still win once they load.
  }
}

let current: Lang = cachedLanguage() ?? systemLanguage();

export const getLanguage = (): Lang => current;

/** Switches the language for strings made from now on (tests, startup). */
export function setLanguage(next: Lang): void {
  current = next;
}

const fill = (text: string, vars?: Vars) =>
  vars
    ? text.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match))
    : text;

export function translate(lang: Lang, message: string, vars?: Vars): string {
  return fill(lang === "tr" ? (TR[message] ?? message) : message, vars);
}

/** Translates into the current language. */
export const t = (message: string, vars?: Vars): string => translate(current, message, vars);

/** Marks a string as a message without translating it (it is translated where shown). */
export const msg = (message: string): string => message;

/** BCP 47 locale for dates and numbers. */
export const localeOf = (lang: Lang = current): string => (lang === "tr" ? "tr-TR" : "en-US");
