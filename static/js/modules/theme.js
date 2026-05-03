/**
 * @module theme
 *
 * Light / dark theme toggle backed by the Pico.css `data-theme` attribute.
 * Persists the chosen theme to `localStorage` under the `"theme"` key.
 *
 * Consumers: main.js (initTheme + toggle-theme action), modules/command-palette.js.
 */

const STORAGE_KEY = "theme";
const ICON_SELECTOR = ".theme-icon";

/**
 * Apply a theme to the document and update the nav icon.
 * @param {"dark" | "light"} theme
 */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const icon = document.querySelector(ICON_SELECTOR);
  if (icon) icon.textContent = theme === "dark" ? "☼" : "☾";
}

/** Flip between light and dark, persisting the choice. */
export function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch (_) {
    /* storage disabled */
  }
}

/** Apply the persisted theme (or default to dark) on startup. */
export function initTheme() {
  let saved = "dark";
  try {
    saved = localStorage.getItem(STORAGE_KEY) || "dark";
  } catch (_) {
    /* storage disabled */
  }
  applyTheme(saved);
}
