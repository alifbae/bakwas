/**
 * @module markdown
 *
 * Markdown → HTML renderer. Owns the dependency on the external `marked`
 * library so the rest of the codebase doesn't have to think about which
 * module system it ships or where it's loaded from.
 *
 * `marked` is imported from a pinned-major ESM CDN build. If you swap the
 * library or host it yourself, change only this file.
 *
 * Consumers: pages/index.js, pages/detail.js.
 */

import { marked } from "https://cdn.jsdelivr.net/npm/marked@18/+esm";
import { escapeHtml } from "./dom.js";

// Open YouTube timestamp links in a new tab so users don't lose the
// summary they're reading. All other links keep marked's defaults.
const YOUTUBE_HOST_RE = /^https?:\/\/(www\.)?(youtu\.be|youtube\.com|m\.youtube\.com)\//i;

marked.use({
  renderer: {
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      const safeHref = escapeHtml(href);
      const targetAttrs = YOUTUBE_HOST_RE.test(href)
        ? ' target="_blank" rel="noopener noreferrer"'
        : "";
      return `<a href="${safeHref}"${titleAttr}${targetAttrs}>${text}</a>`;
    },
  },
});

/**
 * Render markdown text to HTML. On null/undefined input returns an empty
 * string; on parse failure falls back to the HTML-escaped source so the
 * user still sees something readable instead of a broken page.
 *
 * @param {string | null | undefined} text
 * @returns {string} HTML string (safe to assign to `innerHTML`).
 */
export function renderMarkdown(text) {
  if (text == null) return "";
  try {
    return marked.parse(String(text));
  } catch (e) {
    console.error("Markdown parse failed:", e);
    return `<p>${escapeHtml(String(text))}</p>`;
  }
}
