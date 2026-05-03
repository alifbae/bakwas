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
