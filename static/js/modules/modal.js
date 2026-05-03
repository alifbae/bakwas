/**
 * @module modal
 *
 * Helpers for `<dialog>` elements rendered by `templates/partials/modal.html`.
 * Uses the native HTML dialog API with attribute fallback for older engines.
 */

/**
 * Open a dialog by id.
 * @param {string} id
 */
export function openModal(id) {
  const dialog = document.getElementById(id);
  if (!dialog) return;
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
}

/**
 * Close a dialog by id.
 * @param {string} id
 */
export function closeModal(id) {
  const dialog = document.getElementById(id);
  if (!dialog) return;
  if (typeof dialog.close === "function") {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }
}

/**
 * Wire up backdrop-click-to-close for any modal that opts in via
 * `data-close-on-backdrop="true"`. Call once on page init.
 */
export function initModal() {
  document
    .querySelectorAll("dialog.app-modal[data-close-on-backdrop='true']")
    .forEach((dialog) => {
      dialog.addEventListener("click", (e) => {
        if (e.target === dialog) closeModal(dialog.id);
      });
    });
}
