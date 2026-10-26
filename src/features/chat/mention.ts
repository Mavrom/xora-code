// `@file` mentions in the composer: typing "@" and part of a file name lists the folder's
// files; picking one attaches it and takes the "@..." text back out.

export interface MentionToken {
  /** Index of the "@". */
  start: number;
  /** What follows it up to the caret. */
  query: string;
}

/**
 * The mention being typed at `caret`: an "@" at the start or after whitespace, with no
 * whitespace between it and the caret (so e-mail addresses and "a @ b" stay text).
 */
export function mentionToken(value: string, caret: number): MentionToken | null {
  const before = value.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at === -1) return null;
  if (at > 0 && !/\s/.test(before[at - 1])) return null;
  const query = before.slice(at + 1);
  if (/\s/.test(query)) return null;
  return { start: at, query };
}

/** Option id for `aria-activedescendant` on the textarea. */
export const mentionOptionId = (listId: string, index: number) => `${listId}-${index}`;

/** `value` with the token removed, and where the caret goes. */
export function removeMention(value: string, token: MentionToken, caret: number) {
  const text = value.slice(0, token.start) + value.slice(caret).replace(/^ /, "");
  return { text, caret: token.start };
}
