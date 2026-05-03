/**
 * @module command-palette
 *
 * Keyboard-driven command palette (Cmd/Ctrl+K).
 *
 * Combines a short list of built-in actions ("New summary", "Open settings",
 * "Toggle theme") with a fuzzy-search over existing summaries loaded from
 * `/search`. Built as a single lazy DOM overlay appended to `document.body`;
 * keyboard shortcuts and arrow/Enter/Escape handling all live here.
 */

import { isMacPlatform, escapeHtml } from "./dom.js";
import { fetchSearchIndex } from "./api.js";
import { openSettings } from "./preferences.js";
import { toggleTheme } from "./theme.js";

/**
 * @typedef {object} PaletteItem
 * @property {string} title
 * @property {string} [subtitle]
 * @property {() => void} action
 * @property {string} [_haystack] - lowercased search text, cached per item.
 */

let overlay = /** @type {HTMLElement | null} */ (null);
let input = /** @type {HTMLInputElement | null} */ (null);
let list = /** @type {HTMLUListElement | null} */ (null);
/** @type {PaletteItem[]} */
let items = [];
/** @type {PaletteItem[]} */
let filtered = [];
let selectedIndex = 0;

/** @type {Array<{title: string, creator?: string, url: string}>} */
let summaries = [];
let summariesLoaded = false;
/** @type {Promise<void> | null} */
let summariesLoading = null;

/** Open the palette overlay (idempotent). */
export function openCommandPalette() {
  if (overlay) return;
  buildOverlay();
  document.body.appendChild(overlay);
  input.focus();
  // Lazy-load summaries and cache them across opens.
  ensureSummariesLoaded().then(() => {
    refreshItems();
    renderList();
  });
}

/** Tear down the overlay and clear DOM references. */
function closePalette() {
  if (!overlay) return;
  overlay.remove();
  overlay = null;
  input = null;
  list = null;
}

/**
 * Load the search index if not already loaded. Subsequent calls reuse the
 * cached promise so concurrent opens don't double-fetch.
 * @returns {Promise<void>}
 */
function ensureSummariesLoaded() {
  if (summariesLoaded) return Promise.resolve();
  if (summariesLoading) return summariesLoading;
  summariesLoading = fetchSearchIndex()
    .then((data) => {
      summaries = data.summaries || [];
      summariesLoaded = true;
    })
    .catch(() => {
      summaries = [];
      summariesLoaded = true;
    });
  return summariesLoading;
}

/** Construct the DOM overlay (backdrop + panel + input + list + hint). */
function buildOverlay() {
  overlay = document.createElement("div");
  overlay.className = "cmdk-backdrop";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Command palette");

  const panel = document.createElement("div");
  panel.className = "cmdk-panel";

  input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Search summaries or type a command…";
  input.className = "cmdk-input";
  input.autocomplete = "off";
  input.setAttribute("aria-label", "Search commands and summaries");
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-expanded", "true");
  input.setAttribute("aria-controls", "cmdk-listbox");
  input.addEventListener("input", () => {
    selectedIndex = 0;
    renderList();
  });
  input.addEventListener("keydown", onKeydown);

  list = document.createElement("ul");
  list.className = "cmdk-list";
  list.id = "cmdk-listbox";
  list.setAttribute("role", "listbox");

  const hint = document.createElement("div");
  hint.className = "cmdk-hint";
  hint.innerHTML = `
    <span><kbd>↑</kbd> <kbd>↓</kbd> Navigate · <kbd>↵</kbd> Select</span>
    <span><kbd>Esc</kbd> Close</span>
  `;

  panel.appendChild(input);
  panel.appendChild(list);
  panel.appendChild(hint);
  overlay.appendChild(panel);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closePalette();
  });
}

/** Rebuild the item list from built-ins + loaded summaries. */
function refreshItems() {
  /** @type {PaletteItem[]} */
  const builtins = [
    {
      title: "New summary",
      subtitle: "Go to homepage",
      action: () => (window.location.href = "/"),
    },
    {
      title: "Open settings",
      subtitle: "Preferences and usage stats",
      action: () => {
        closePalette();
        openSettings();
      },
    },
    {
      title: "Toggle theme",
      subtitle: "Light / dark",
      action: () => {
        closePalette();
        toggleTheme();
      },
    },
  ];

  const summaryItems = summaries.map((s) => ({
    title: s.title,
    subtitle: s.creator || "",
    action: () => (window.location.href = s.url),
    _haystack: `${s.title} ${s.creator || ""}`.toLowerCase(),
  }));

  items = builtins.concat(summaryItems);
}

/**
 * Simple fuzzy match: every character of `q` must appear in order in `text`.
 * Consecutive matches score higher so exact substrings float to the top.
 *
 * @param {string} text
 * @param {string} q
 * @returns {number} 0 if no match, higher = better.
 */
function fuzzyScore(text, q) {
  if (!q) return 1;
  const t = text.toLowerCase();
  let score = 0;
  let prev = -1;
  for (let i = 0; i < q.length; i++) {
    const idx = t.indexOf(q[i], prev + 1);
    if (idx === -1) return 0;
    score += idx === prev + 1 ? 2 : 1;
    prev = idx;
  }
  return score;
}

/**
 * Filter + sort the master items list by fuzzy score of the current query.
 * @param {string} query
 * @returns {PaletteItem[]}
 */
function filterItems(query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return items.slice(0, 50);
  return items
    .map((it) => {
      const hay =
        it._haystack || `${it.title} ${it.subtitle || ""}`.toLowerCase();
      return { item: it, score: fuzzyScore(hay, q) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 50)
    .map((x) => x.item);
}

/** Re-render the list from the current query + selection. */
function renderList() {
  if (!list) return;
  filtered = filterItems(input.value);
  if (!filtered.length) {
    list.innerHTML = '<li class="cmdk-empty">No matches</li>';
    return;
  }
  list.innerHTML = "";
  filtered.forEach((it, i) => {
    const li = document.createElement("li");
    li.className = "cmdk-item";
    li.setAttribute("role", "option");
    if (i === selectedIndex) li.setAttribute("aria-selected", "true");
    li.innerHTML = `
      <span class="cmdk-item__title">${escapeHtml(it.title)}</span>
      <span class="cmdk-item__sub">${escapeHtml(it.subtitle || "")}</span>
    `;
    li.addEventListener("mousemove", () => {
      if (selectedIndex !== i) {
        selectedIndex = i;
        updateSelection();
      }
    });
    li.addEventListener("click", () => run(it));
    list.appendChild(li);
  });
}

/** Sync aria-selected attributes to the current selectedIndex. */
function updateSelection() {
  if (!list) return;
  [...list.children].forEach((child, i) => {
    if (i === selectedIndex) {
      child.setAttribute("aria-selected", "true");
      child.scrollIntoView({ block: "nearest" });
    } else {
      child.removeAttribute("aria-selected");
    }
  });
}

/**
 * Dispatch an item's action and close the palette.
 * @param {PaletteItem | undefined} item
 */
function run(item) {
  if (!item) return;
  const action = item.action;
  if (overlay) closePalette();
  if (typeof action === "function") action();
}

/**
 * Input keydown handler: Esc closes, ArrowUp/Down navigates, Enter runs.
 * @param {KeyboardEvent} e
 */
function onKeydown(e) {
  if (e.key === "Escape") {
    e.preventDefault();
    closePalette();
    return;
  }
  if (e.key === "ArrowDown") {
    e.preventDefault();
    selectedIndex = Math.min(selectedIndex + 1, filtered.length - 1);
    updateSelection();
    return;
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    selectedIndex = Math.max(selectedIndex - 1, 0);
    updateSelection();
    return;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    run(filtered[selectedIndex]);
  }
}

/**
 * Install the global Cmd/Ctrl+K shortcut and adjust the nav trigger's
 * displayed modifier to match the user's platform.
 */
export function initCommandPalette() {
  document.addEventListener("keydown", (e) => {
    const modifier = isMacPlatform() ? e.metaKey : e.ctrlKey;
    if (modifier && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (overlay) closePalette();
      else openCommandPalette();
    }
  });

  // Swap the nav trigger's shortcut label to the right platform.
  const el = document.querySelector(".cmdk-trigger__kbd");
  if (el) {
    el.textContent = isMacPlatform() ? "⌘K" : "Ctrl+K";
  }
}
