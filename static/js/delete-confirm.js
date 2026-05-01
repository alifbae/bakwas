// Confirm-delete modal wiring.
// Usage in templates:
//   <form method="POST" action="{{ delete_url }}">
//     <button type="submit" class="delete-btn" data-confirm-delete
//             data-confirm-message="Optional custom message"> … </button>
//   </form>
//
// When the button is clicked, submission is intercepted and a shared
// confirmation modal is shown. The form only submits if the user confirms.

$(document).ready(function () {
  let pendingForm = null;

  const $modal = $("#confirm-delete-dialog");
  const $confirmBtn = $("#confirm-delete-btn");
  const $message = $("#confirm-delete-message");
  const defaultMessage = $message.text();

  // Intercept any click on a trigger button inside a form.
  $(document).on("click", "[data-confirm-delete]", function (e) {
    const form = this.closest("form");
    if (!form) return;

    e.preventDefault();

    pendingForm = form;

    const customMessage = this.getAttribute("data-confirm-message");
    $message.text(customMessage || defaultMessage);

    openModal("confirm-delete-dialog");
  });

  // Clear reference if user cancels or dismisses.
  $modal.on("close", function () {
    pendingForm = null;
  });

  $confirmBtn.on("click", function () {
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
});
