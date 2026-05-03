/**
 * @module delete-confirm
 *
 * Confirm-delete modal wiring.
 *
 * Any form whose submit button has `data-confirm-delete` is intercepted
 * on click; the shared `#confirm-delete-dialog` is shown, and the form
 * only submits if the user confirms.
 *
 * Usage in templates:
 *     <form method="POST" action="{{ delete_url }}">
 *       <button type="submit" data-confirm-delete
 *               data-confirm-message="Optional custom message"> … </button>
 *     </form>
 *
 * Depends on: modal.js.
 * Consumers: main.js (initDeleteConfirm).
 */

import { openModal, closeModal } from "./modal.js";

/** Install delegated click listeners. Call once from `main.js`. */
export function initDeleteConfirm() {
  const modal = document.getElementById("confirm-delete-dialog");
  const confirmBtn = document.getElementById("confirm-delete-btn");
  const messageEl = document.getElementById("confirm-delete-message");
  if (!modal || !confirmBtn || !messageEl) return;

  const defaultMessage = messageEl.textContent;
  /** @type {HTMLFormElement | null} */
  let pendingForm = null;

  // Delegated click for any [data-confirm-delete] button in any form.
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-confirm-delete]");
    if (!trigger) return;
    const form = trigger.closest("form");
    if (!form) return;

    e.preventDefault();
    pendingForm = form;

    const custom = trigger.getAttribute("data-confirm-message");
    messageEl.textContent = custom || defaultMessage;

    openModal("confirm-delete-dialog");
  });

  // Clear pending form if the dialog is dismissed (Esc, backdrop, Cancel).
  modal.addEventListener("close", () => {
    pendingForm = null;
  });

  confirmBtn.addEventListener("click", () => {
    const form = pendingForm;
    pendingForm = null;
    closeModal("confirm-delete-dialog");
    if (form) {
      // Persist a flag so the next page load can surface a success toast.
      try {
        sessionStorage.setItem("bakwas.flash", "summary-deleted");
      } catch (_) {
        /* storage disabled */
      }
      form.submit();
    }
  });
}
