// Tiny toast notification system.
// Usage: toast("Saved!", { type: "success" })
// Types: "success" | "error" | "info" (default)

(function () {
  const CONTAINER_ID = "toast-container";
  const DEFAULT_DURATION = 3500;

  function getContainer() {
    let el = document.getElementById(CONTAINER_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = CONTAINER_ID;
      el.className = "toast-container";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    return el;
  }

  window.toast = function (message, opts) {
    opts = opts || {};
    const type = opts.type || "info";
    const duration = opts.duration != null ? opts.duration : DEFAULT_DURATION;

    const container = getContainer();
    const node = document.createElement("div");
    node.className = "toast toast--" + type;
    node.setAttribute("role", type === "error" ? "alert" : "status");
    node.textContent = message;

    container.appendChild(node);

    // Force reflow so the transition runs.
    void node.offsetWidth;
    node.classList.add("toast--visible");

    const remove = function () {
      node.classList.remove("toast--visible");
      node.addEventListener(
        "transitionend",
        function () {
          node.remove();
        },
        { once: true }
      );
    };

    const timer = setTimeout(remove, duration);

    node.addEventListener("click", function () {
      clearTimeout(timer);
      remove();
    });
  };

  // Consume any "flash" message stored in sessionStorage before a navigation.
  function drainFlash() {
    try {
      const flash = sessionStorage.getItem("bakwas.flash");
      if (!flash) return;
      sessionStorage.removeItem("bakwas.flash");
      if (flash === "summary-deleted") {
        window.toast("Summary deleted", { type: "success" });
      }
    } catch (_) {
      /* storage disabled */
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", drainFlash);
  } else {
    drainFlash();
  }
})();
