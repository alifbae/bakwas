// Shared modal helpers for dialogs rendered by templates/modal.html

function openModal(id) {
  const dialog = document.getElementById(id);
  if (!dialog) return;
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
}

function closeModal(id) {
  const dialog = document.getElementById(id);
  if (!dialog) return;
  if (typeof dialog.close === "function") {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }
}

// Wire up backdrop-click-to-close for any modal that opts in.
$(document).ready(function () {
  $("dialog.app-modal[data-close-on-backdrop='true']").on("click", function (e) {
    if (e.target === this) {
      closeModal(this.id);
    }
  });
});
