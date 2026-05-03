// Tiny toast notification system.
// Usage:
//   import { toast } from "./toast.js";
//   toast("Saved!", { type: "success" });
// Types: "success" | "error" | "info" (default).
//
// For back-compat with inline HTML handlers that expect a global, main.js
// assigns `window.toast = toast`.

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

export function toast(message, opts = {}) {
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

  const remove = () => {
    node.classList.remove("toast--visible");
    node.addEventListener(
      "transitionend",
      () => node.remove(),
      { once: true }
    );
  };

  const timer = setTimeout(remove, duration);

  node.addEventListener("click", () => {
    clearTimeout(timer);
    remove();
  });
}

// Consume any "flash" message stored in sessionStorage before a navigation.
// Called once from main.js on startup.
export function drainFlash() {
  try {
    const flash = sessionStorage.getItem("bakwas.flash");
    if (!flash) return;
    sessionStorage.removeItem("bakwas.flash");
    if (flash === "summary-deleted") {
      toast("Summary deleted", { type: "success" });
    }
  } catch (_) {
    /* storage disabled */
  }
}
