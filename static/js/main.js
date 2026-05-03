/**
 * @module main
 *
 * Base entry module, loaded on every page from base.html.
 *
 * Responsibilities:
 *   - Initialize always-on UI (theme, modal wiring, toasts, datetime, delete
 *     confirmation, command palette).
 *   - Register named UI actions (see modules/actions.js) so templates can
 *     wire behavior via `data-action="…"` instead of inline `onclick=`.
 *   - Apply any pre-render redirects (items-per-page sync on the homepage).
 */

import { initTheme, toggleTheme } from "./modules/theme.js";
import { initModal, closeModal } from "./modules/modal.js";
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
import {
  initActions,
  registerActions,
  registerFormAction,
} from "./modules/actions.js";

// --- Action registry ------------------------------------------------------
// Each entry maps a `data-action="name"` attribute to the function fired
// when that element is clicked. For close-modal, the handler walks up to
// the enclosing <dialog> so templates don't need to pass an explicit id.

registerActions({
  "open-settings": () => openSettings(),
  "open-command-palette": () => openCommandPalette(),
  "toggle-theme": () => toggleTheme(),
  "close-modal": (el) => {
    const dialog = el.closest("dialog");
    if (dialog && dialog.id) closeModal(dialog.id);
  },
});

registerFormAction("save-settings", (form, event) => {
  event.preventDefault();
  saveSettings(event);
});

// Some modules still expect a globally available `toast()` (e.g. future
// inline hooks / embedded snippets). Keeping just this one until we have
// a reason to remove it — everything else is wired through actions now.
window.toast = toast;

// --------------------------------------------------------------------------

function ready(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  } else {
    fn();
  }
}

// Must run before DOMContentLoaded: redirects on the homepage if the URL
// is missing per_page (prevents a flash of default content).
initHomepagePerPageRedirect();

ready(() => {
  initActions();
  initTheme();
  initModal();
  initDateTime();
  initDeleteConfirm();
  initCommandPalette();
  drainFlash();
});
