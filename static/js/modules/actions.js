/**
 * @module actions
 *
 * Event-delegation registry for UI actions.
 *
 * Instead of wiring individual `addEventListener` calls for each button, or
 * exposing callables on `window` for inline `onclick=` handlers, templates
 * declare intent via `data-action` / `data-form-action` attributes:
 *
 *   <button data-action="open-settings">…</button>
 *   <button data-action="close-modal">…</button>   (closes the enclosing <dialog>)
 *   <form data-form-action="save-settings">…</form>
 *
 * JS registers named handlers once at startup; the single delegated click
 * and submit listeners fire the right one. This keeps modules free of
 * globals and makes "where is this button wired?" grep-able.
 */

const clickActions = new Map();
const submitActions = new Map();

/**
 * Register a click action handler.
 * @param {string} name - matches `data-action="…"` on the element.
 * @param {(el: HTMLElement, event: MouseEvent) => void} handler
 */
export function registerAction(name, handler) {
  clickActions.set(name, handler);
}

/**
 * Register a form-submit action handler.
 * @param {string} name - matches `data-form-action="…"` on the <form>.
 * @param {(form: HTMLFormElement, event: SubmitEvent) => void} handler
 */
export function registerFormAction(name, handler) {
  submitActions.set(name, handler);
}

/**
 * Register multiple click actions at once.
 * @param {Record<string, (el: HTMLElement, event: MouseEvent) => void>} map
 */
export function registerActions(map) {
  for (const [name, handler] of Object.entries(map)) {
    registerAction(name, handler);
  }
}

/**
 * Programmatically fire a registered click action by name. Useful for
 * non-click triggers (e.g. command-palette items) that want to reuse the
 * same action map.
 * @param {string} name
 * @param {HTMLElement} [el] - optional element to pass to the handler.
 */
export function runAction(name, el) {
  const handler = clickActions.get(name);
  if (handler) handler(el || document.body, new MouseEvent("click"));
}

/** Install the delegated click + submit listeners. Call once at startup. */
export function initActions() {
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const handler = clickActions.get(el.dataset.action);
    if (!handler) return;
    handler(el, e);
  });

  document.addEventListener("submit", (e) => {
    const form = e.target.closest("[data-form-action]");
    if (!form) return;
    const handler = submitActions.get(form.dataset.formAction);
    if (!handler) return;
    handler(form, e);
  });
}
