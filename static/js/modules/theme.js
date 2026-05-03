// Theme management with Pico.css data-theme attribute.
// Stores selection in localStorage under "theme".

const STORAGE_KEY = "theme";
const ICON_SELECTOR = ".theme-icon";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const icon = document.querySelector(ICON_SELECTOR);
  if (icon) icon.textContent = theme === "dark" ? "☼" : "☾";
}

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

export function initTheme() {
  let saved = "dark";
  try {
    saved = localStorage.getItem(STORAGE_KEY) || "dark";
  } catch (_) {
    /* storage disabled */
  }
  applyTheme(saved);
}
