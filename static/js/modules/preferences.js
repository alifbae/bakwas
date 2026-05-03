/**
 * @module preferences
 *
 * User preferences stored in `localStorage`.
 *
 * Keys:
 *   - `bakwas.defaultModel`     — preferred LLM model id
 *   - `bakwas.defaultLength`    — preferred summary length
 *   - `bakwas.itemsPerPage`     — pagination size on the homepage
 *
 * Exports:
 *   - accessor helpers (`getDefaultModel`, etc.) used by other modules.
 *   - `openSettings` / `saveSettings` for the settings dialog.
 *   - `initHomepagePerPageRedirect` which syncs the URL `per_page` query
 *     param to the saved preference on first homepage load.
 *
 * Depends on: modal.js, toast.js, api.js.
 * Consumers: main.js, modules/command-palette.js, pages/index.js.
 */

import { openModal, closeModal } from "./modal.js";
import { toast } from "./toast.js";
import { fetchModels, fetchStats } from "./api.js";

/** localStorage keys for each preference. */
const PREFS_KEYS = {
  defaultModel: "bakwas.defaultModel",
  defaultLength: "bakwas.defaultLength",
  itemsPerPage: "bakwas.itemsPerPage",
};

const DEFAULT_ITEMS_PER_PAGE = 10;

/** @param {string} key */
function getPreference(key) {
  return localStorage.getItem(key);
}

/**
 * Persist a preference. Removing (by passing empty-ish value) keeps the
 * store clean so fallbacks kick in.
 * @param {string} key
 * @param {string | null | undefined} value
 */
function setPreference(key, value) {
  if (value === null || value === undefined || value === "") {
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, value);
  }
}

/** @returns {string | null} */
export function getDefaultModel() {
  return getPreference(PREFS_KEYS.defaultModel);
}

/** @returns {string | null} */
export function getDefaultLength() {
  return getPreference(PREFS_KEYS.defaultLength);
}

/**
 * Get the items-per-page preference. Returns a positive integer, or the
 * literal string `"all"` when the user has opted out of pagination.
 *
 * @returns {number | "all"}
 */
export function getItemsPerPage() {
  const v = getPreference(PREFS_KEYS.itemsPerPage);
  if (v === "all") return "all";
  if (v) {
    const n = parseInt(v, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_ITEMS_PER_PAGE;
}

// ---------------------------------------------------------------------------
// Settings dialog
// ---------------------------------------------------------------------------

/** Populate the settings dialog's model <select> from the server. */
async function loadSettingsModels() {
  const select = document.getElementById("prefs-default-model");
  if (!select) return;

  try {
    const data = await fetchModels();

    const savedModel = getDefaultModel();
    select.innerHTML = "";

    let fallbackValue = null;
    (data.models || []).forEach((model) => {
      const option = document.createElement("option");
      option.value = model.id;
      option.textContent = model.name;
      select.appendChild(option);
      if (fallbackValue === null && model.default) {
        fallbackValue = model.id;
      }
    });

    if (fallbackValue === null && data.models && data.models.length > 0) {
      fallbackValue = data.models[0].id;
    }

    const hasSaved =
      savedModel && select.querySelector(`option[value="${CSS.escape(savedModel)}"]`);
    const effective = hasSaved ? savedModel : fallbackValue;
    if (effective) select.value = effective;
  } catch (_) {
    select.innerHTML = '<option value="">Error loading models</option>';
  }
}

/** Seed the length <select> from the saved preference, if any. */
function loadSettingsLength() {
  const select = document.getElementById("prefs-default-length");
  if (!select) return;
  const savedLength = getDefaultLength();
  if (
    savedLength &&
    select.querySelector(`option[value="${CSS.escape(savedLength)}"]`)
  ) {
    select.value = savedLength;
  }
  // else leave the first option selected by default
}

/** Seed the items-per-page <select> from the saved preference. */
function loadSettingsItemsPerPage() {
  const select = document.getElementById("prefs-items-per-page");
  if (!select) return;
  const saved = getItemsPerPage();
  const value = String(saved);
  if (select.querySelector(`option[value="${CSS.escape(value)}"]`)) {
    select.value = value;
  }
}

/**
 * Format a USD amount. Shows more precision when the total is small
 * (<$1) so rounding isn't confusing.
 *
 * @param {number | null | undefined} n
 * @returns {string}
 */
function formatUsd(n) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
  const v = Number(n);
  return v >= 1 ? `${v.toFixed(2)}` : `${v.toFixed(4)}`;
}

/**
 * Locale-format a count, or em-dash for nullish.
 * @param {number | null | undefined} n
 * @returns {string}
 */
function formatCount(n) {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString();
}

/**
 * Safely assign textContent to an element by id.
 * @param {string} id
 * @param {string} value
 */
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/** Populate the usage-stats block in the settings dialog. */
async function loadSettingsStats() {
  setText("stats-total-cost", "…");
  setText("stats-total-summaries", "…");
  setText("stats-total-tokens", "…");
  setText("stats-priced-note", "");

  try {
    const data = await fetchStats();

    setText("stats-total-cost", formatUsd(data.total_cost_usd));
    setText("stats-total-summaries", formatCount(data.total_summaries));

    const tokens =
      (Number(data.total_prompt_tokens) || 0) +
      (Number(data.total_completion_tokens) || 0);
    setText(
      "stats-total-tokens",
      tokens
        ? `${formatCount(tokens)} (${formatCount(data.total_prompt_tokens)} in / ${formatCount(data.total_completion_tokens)} out)`
        : "—"
    );

    const priced = Number(data.priced_summaries) || 0;
    const total = Number(data.total_summaries) || 0;
    if (total > 0 && priced < total) {
      const missing = total - priced;
      setText(
        "stats-priced-note",
        `${formatCount(missing)} summar${missing === 1 ? "y has" : "ies have"} no cost data (e.g. generated before tracking was added or via an unpriced provider).`
      );
    } else {
      setText("stats-priced-note", "");
    }
  } catch (_) {
    setText("stats-total-cost", "—");
    setText("stats-total-summaries", "—");
    setText("stats-total-tokens", "—");
    setText("stats-priced-note", "Failed to load usage stats.");
  }
}

/** Open the settings dialog, populating it with current values + stats. */
export function openSettings() {
  loadSettingsModels();
  loadSettingsLength();
  loadSettingsItemsPerPage();
  loadSettingsStats();
  openModal("settings-dialog");
}

/** Close the settings dialog without saving. */
export function closeSettings() {
  closeModal("settings-dialog");
}

/**
 * Persist the settings form, apply to the homepage form in-place, and
 * reload the homepage if `per_page` changed (so the server re-paginates).
 *
 * @param {Event} [e] - the submit event, if called from a form handler.
 */
export function saveSettings(e) {
  if (e && e.preventDefault) e.preventDefault();

  const modelEl = document.getElementById("prefs-default-model");
  const lengthEl = document.getElementById("prefs-default-length");
  const ippEl = document.getElementById("prefs-items-per-page");

  const model = modelEl ? modelEl.value : "";
  const length = lengthEl ? lengthEl.value : "";
  const itemsPerPage = ippEl ? ippEl.value : "";

  setPreference(PREFS_KEYS.defaultModel, model);
  setPreference(PREFS_KEYS.defaultLength, length);
  setPreference(PREFS_KEYS.itemsPerPage, itemsPerPage);

  // Apply immediately to the homepage form if present
  const homeModel = document.getElementById("model");
  const homeLength = document.getElementById("length");
  if (
    model &&
    homeModel &&
    homeModel.querySelector(`option[value="${CSS.escape(model)}"]`)
  ) {
    homeModel.value = model;
  }
  if (
    length &&
    homeLength &&
    homeLength.querySelector(`option[value="${CSS.escape(length)}"]`)
  ) {
    homeLength.value = length;
  }

  closeSettings();
  toast("Settings saved", { type: "success" });

  // On the homepage, reload so the server re-queries with the new per_page.
  const onHome =
    window.location.pathname === "/" || window.location.pathname === "";
  if (onHome) {
    const params = new URLSearchParams(window.location.search);
    if (itemsPerPage) {
      params.set("per_page", itemsPerPage);
      params.set("page", "1");
    }
    const qs = params.toString();
    window.location.href = window.location.pathname + (qs ? "?" + qs : "");
  }
}

/**
 * On the homepage, if the URL doesn't already specify `per_page`, redirect
 * once using the saved (or default) items-per-page so the server applies
 * pagination consistently.
 */
export function initHomepagePerPageRedirect() {
  const onHome =
    window.location.pathname === "/" || window.location.pathname === "";
  if (!onHome) return;
  const params = new URLSearchParams(window.location.search);
  if (params.has("per_page")) return;
  const perPage = getItemsPerPage();
  params.set("per_page", String(perPage));
  if (perPage !== "all" && !params.has("page")) params.set("page", "1");
  window.location.replace(
    window.location.pathname + "?" + params.toString()
  );
}
