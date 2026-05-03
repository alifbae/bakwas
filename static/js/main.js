// Base entry module. Loaded on every page from base.html.
// Wires up the always-on UI behaviors (theme, modals, toasts, datetime, etc.)
// and exposes a small set of functions on `window` for the inline HTML
// handlers still present in templates (onclick="openSettings()", etc.).

import { initTheme, toggleTheme } from "./modules/theme.js";
import { initModal, openModal, closeModal } from "./modules/modal.js";
import { toast, drainFlash } from "./modules/toast.js";
import { initDateTime } from "./modules/datetime.js";
import { initDeleteConfirm } from "./modules/delete-confirm.js";
import {
  openSettings,
  saveSettings,
  initHomepagePerPageRedirect,
} from "./modules/preferences.js";
import {
  initCommandPalette,
  openCommandPalette,
} from "./modules/command-palette.js";

// --- Globals for inline HTML handlers -------------------------------------
// Templates use onclick="openSettings()", onclick="toggleTheme()",
// onclick="closeModal('id')", onsubmit="saveSettings(event)", etc.
// Modules don't create globals, so we re-expose these explicitly here.
// (Keep this list tight — any new handler should prefer a data-* listener.)
window.toast = toast;
window.toggleTheme = toggleTheme;
window.openModal = openModal;
window.closeModal = closeModal;
window.openSettings = openSettings;
window.saveSettings = saveSettings;
window.openCommandPalette = openCommandPalette;
// --------------------------------------------------------------------------

// Redirect-on-load (must run before other init so navigation happens early
// if needed).
initHomepagePerPageRedirect();

function ready(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  } else {
    fn();
  }
}

ready(() => {
  initTheme();
  initModal();
  initDateTime();
  initDeleteConfirm();
  initCommandPalette();
  drainFlash();
});
