// Shared modal helpers for <dialog> elements rendered by templates/modal.html.
//
// Exports openModal/closeModal. main.js also exposes these on window for the
// inline onclick="closeModal('id')" handlers still present in templates.

export function openModal(id) {
  const dialog = document.getElementById(id);
  if (!dialog) return;
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
}

export function closeModal(id) {
  const dialog = document.getElementById(id);
  if (!dialog) return;
  if (typeof dialog.close === "function") {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }
}

// Wire up backdrop-click-to-close for any modal that opts in.
export function initModal() {
  document
    .querySelectorAll("dialog.app-modal[data-close-on-backdrop='true']")
    .forEach((dialog) => {
      dialog.addEventListener("click", (e) => {
        if (e.target === dialog) closeModal(dialog.id);
      });
    });
}
