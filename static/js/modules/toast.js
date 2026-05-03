/**
 * @module toast
 *
 * Tiny toast notification system. Appends to a shared container in
 * `document.body`, animates in/out via CSS class toggles, and auto-dismisses
 * after a configurable duration. Clicking a toast dismisses it immediately.
 *
 * Usage:
 *     import { toast } from "./toast.js";
 *     toast("Saved!", { type: "success" });
 */

const CONTAINER_ID = "toast-container";
const DEFAULT_DURATION = 3500;

/**
 * @typedef {object} ToastOptions
 * @property {"success" | "error" | "info"} [type="info"]
 * @property {number} [duration=3500] - milliseconds; 0 keeps the toast on screen.
 */

/** Lazily create (or return) the shared container element. */
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

/**
 * Show a toast message.
 * @param {string} message
 * @param {ToastOptions} [opts]
 */
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

/**
 * Consume any "flash" message stored in `sessionStorage` before a navigation.
 * Used by modules that trigger a full-page reload (e.g. delete-confirm) to
 * surface a toast on the next page. Call once at startup.
 */
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
