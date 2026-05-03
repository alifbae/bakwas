/**
 * @module dom
 *
 * Small DOM / environment helpers shared across modules. Everything here
 * is pure enough to be testable in isolation.
 *
 * Consumers: modules/command-palette.js, pages/index.js, pages/detail.js.
 */

/**
 * Escape a string for safe insertion into HTML. Use sparingly — prefer
 * `textContent` or element construction where possible.
 *
 * @param {unknown} s - Coerced to a string before escaping.
 * @returns {string} HTML-safe representation of `s`.
 */
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/**
 * Read and JSON-parse a `<script type="application/json" id="…">` block.
 * Returns `null` on missing element or parse failure (logged to console).
 *
 * @param {string} id
 * @returns {*}
 */
export function readJsonScript(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  try {
    return JSON.parse(el.textContent);
  } catch (e) {
    console.error("Failed to parse JSON from #" + id, e);
    return null;
  }
}

/**
 * Detect whether we're running on macOS. Prefers the modern
 * `navigator.userAgentData` and falls back to legacy `navigator.platform` /
 * `userAgent`. Covers Intel and Apple Silicon.
 *
 * @returns {boolean}
 */
export function isMacPlatform() {
  const ua = navigator.userAgentData;
  if (ua && typeof ua.platform === "string") {
    return ua.platform.toLowerCase().includes("mac");
  }
  const legacy = (navigator.platform || "") + " " + (navigator.userAgent || "");
  return /mac/i.test(legacy);
}

/**
 * Clone a `<template>` element by id and return the cloned DocumentFragment.
 * Throws on missing template — renderers shouldn't silently no-op on a typo.
 *
 * @param {string} id
 * @returns {DocumentFragment}
 */
export function cloneTemplate(id) {
  const tpl = document.getElementById(id);
  if (!tpl || tpl.tagName !== "TEMPLATE") {
    throw new Error(`Missing <template id="${id}">`);
  }
  return tpl.content.cloneNode(true);
}
