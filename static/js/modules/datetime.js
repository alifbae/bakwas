/**
 * @module datetime
 *
 * Convert server-rendered UTC timestamps to the user's local time.
 * Templates mark up cells with `data-utc-time` / `data-utc-date`;
 * `initDateTime()` rewrites their `textContent` on page load.
 */

/**
 * Format a UTC timestamp as a localized date-time string.
 * @param {string} utcDateString - e.g. `"2025-04-01 12:34:56"` (no timezone).
 * @returns {string}
 */
export function formatLocalDateTime(utcDateString) {
  if (!utcDateString) return "N/A";
  try {
    const date = new Date(utcDateString + "Z"); // server emits naive UTC
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_) {
    return utcDateString;
  }
}

/**
 * Format a UTC timestamp as a localized date-only string.
 * @param {string} utcDateString
 * @returns {string}
 */
export function formatLocalDate(utcDateString) {
  if (!utcDateString) return "N/A";
  try {
    const date = new Date(utcDateString + "Z");
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (_) {
    return utcDateString;
  }
}

/**
 * Scan the document for `[data-utc-time]` / `[data-utc-date]` elements and
 * rewrite their `textContent` to the user's locale.
 */
export function initDateTime() {
  document.querySelectorAll("[data-utc-time]").forEach((el) => {
    const utc = el.getAttribute("data-utc-time");
    el.textContent = formatLocalDateTime(utc);
  });
  document.querySelectorAll("[data-utc-date]").forEach((el) => {
    const utc = el.getAttribute("data-utc-date");
    el.textContent = formatLocalDate(utc);
  });
}
