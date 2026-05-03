// Command palette (Cmd/Ctrl+K).
// Fuzzy-search summaries by title and creator, plus built-in actions.

import { isMacPlatform, escapeHtml } from "./dom.js";

let overlay = null;
let input = null;
let list = null;
let items = []; // { title, subtitle, action, _haystack? }
let filtered = [];
let selectedIndex = 0;
let summaries = [];
let summariesLoaded = false;
let summariesLoading = null;

export function openCommandPalette() {
  if (overlay) return;
  buildOverlay();
  document.body.appendChild(overlay);
  input.focus();
  // Lazy-load summaries (cache for subsequent opens)
  ensureSummariesLoaded().then(() => {
    refreshItems();
    renderList();
  });
}

function closePalette() {
  if (!overlay) return;
  overlay.remove();
  overlay = null;
  input = null;
  list = null;
}

function ensureSummariesLoaded() {
  if (summariesLoaded) return Promise.resolve();
  if (summariesLoading) return summariesLoading;
  summariesLoading = fetch("/search")
    .then((r) => (r.ok ? r.json() : { summaries: [] }))
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

function refreshItems() {
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
        if (typeof window.openSettings === "function") window.openSettings();
      },
    },
    {
      title: "Toggle theme",
      subtitle: "Light / dark",
      action: () => {
        closePalette();
        if (typeof window.toggleTheme === "function") window.toggleTheme();
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

// Simple fuzzy match: every character of q must appear in order in text.
// Scoring gives consecutive matches a boost so exact substrings float up.
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

function run(item) {
  if (!item) return;
  const action = item.action;
  if (overlay) closePalette();
  if (typeof action === "function") action();
}

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

export function initCommandPalette() {
  // Global keyboard shortcut (Cmd+K on macOS, Ctrl+K everywhere else)
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
