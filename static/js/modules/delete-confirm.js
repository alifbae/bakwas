// Confirm-delete modal wiring.
// Usage in templates:
//   <form method="POST" action="{{ delete_url }}">
//     <button type="submit" class="delete-btn" data-confirm-delete
//             data-confirm-message="Optional custom message"> … </button>
//   </form>
//
// When the button is clicked, submission is intercepted and a shared
// confirmation modal (#confirm-delete-dialog) is shown. The form only
// submits if the user confirms.

import { openModal, closeModal } from "./modal.js";

export function initDeleteConfirm() {
  const modal = document.getElementById("confirm-delete-dialog");
  const confirmBtn = document.getElementById("confirm-delete-btn");
  const messageEl = document.getElementById("confirm-delete-message");
  if (!modal || !confirmBtn || !messageEl) return;

  const defaultMessage = messageEl.textContent;
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
      // Persist a flag so the next page load can show a success toast.
      try {
        sessionStorage.setItem("bakwas.flash", "summary-deleted");
      } catch (_) {
        /* storage disabled */
      }
      form.submit();
    }
  });
}
