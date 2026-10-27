// Markdown block -> sanitised HTML. Raw HTML from the agent is shown as text, images become
// links (no remote fetches from the transcript), and code blocks get a small header with
// the language and a copy button (wired up by event delegation in Markdown.tsx).
import DOMPurify from "dompurify";
import { Marked } from "marked";
import { t } from "@/shared/i18n";

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

const marked = new Marked({
  gfm: true,
  breaks: false,
  async: false,
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    },
    image({ href, text }) {
      return `<a href="${escapeHtml(href)}">${escapeHtml(text || href)}</a>`;
    },
    code({ text, lang }) {
      const language = (lang ?? "").trim().split(/\s+/)[0].toLowerCase();
      return (
        `<div class="md-code" data-lang="${escapeHtml(language)}">` +
        `<div class="md-code-head"><span>${escapeHtml(language || t("text"))}</span>` +
        `<button type="button" class="md-code-copy" data-copy aria-label="${escapeHtml(t("Copy code"))}">` +
        `${escapeHtml(t("Copy"))}</button></div>` +
        `<pre><code>${escapeHtml(text)}</code></pre></div>`
      );
    },
  },
});

const PURIFY_CONFIG = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ["img", "style", "form", "input", "textarea", "select", "iframe"],
};

/** Renders one markdown block to HTML that is safe to inject. */
export function renderMarkdown(source: string): string {
  const html = marked.parse(source) as string;
  return DOMPurify.sanitize(html, PURIFY_CONFIG);
}
