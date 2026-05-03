// User preferences stored in localStorage.
// Keys: bakwas.defaultModel, bakwas.defaultLength, bakwas.itemsPerPage

import { openModal, closeModal } from "./modal.js";
import { toast } from "./toast.js";

const PREFS_KEYS = {
  defaultModel: "bakwas.defaultModel",
  defaultLength: "bakwas.defaultLength",
  itemsPerPage: "bakwas.itemsPerPage",
};

const DEFAULT_ITEMS_PER_PAGE = 10;

function getPreference(key) {
  return localStorage.getItem(key);
}

function setPreference(key, value) {
  if (value === null || value === undefined || value === "") {
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, value);
  }
}

export function getDefaultModel() {
  return getPreference(PREFS_KEYS.defaultModel);
}

export function getDefaultLength() {
  return getPreference(PREFS_KEYS.defaultLength);
}

// Returns a positive integer or the string "all".
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

async function loadSettingsModels() {
  const select = document.getElementById("prefs-default-model");
  if (!select) return;

  try {
    const response = await fetch("/models");
    if (!response.ok) throw new Error("Failed to load models");
    const data = await response.json();

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

function loadSettingsItemsPerPage() {
  const select = document.getElementById("prefs-items-per-page");
  if (!select) return;
  const saved = getItemsPerPage();
  const value = String(saved);
  if (select.querySelector(`option[value="${CSS.escape(value)}"]`)) {
    select.value = value;
  }
}

function formatUsd(n) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
  const v = Number(n);
  // Show more precision when the total is small (<$1) so rounding isn't confusing.
  return v >= 1 ? `${v.toFixed(2)}` : `${v.toFixed(4)}`;
}

function formatCount(n) {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString();
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

async function loadSettingsStats() {
  setText("stats-total-cost", "…");
  setText("stats-total-summaries", "…");
  setText("stats-total-tokens", "…");
  setText("stats-priced-note", "");

  try {
    const response = await fetch("/stats");
    if (!response.ok) throw new Error("stats request failed");
    const data = await response.json();

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

export function openSettings() {
  loadSettingsModels();
  loadSettingsLength();
  loadSettingsItemsPerPage();
  loadSettingsStats();
  openModal("settings-dialog");
}

export function closeSettings() {
  closeModal("settings-dialog");
}

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

// On the homepage, if the URL doesn't already specify per_page, redirect once
// using the saved (or default) items-per-page so the server applies pagination
// consistently.
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
