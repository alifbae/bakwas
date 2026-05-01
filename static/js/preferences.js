// User preferences stored in localStorage
// Keys: bakwas.defaultModel, bakwas.defaultLength, bakwas.itemsPerPage

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

function getDefaultModel() {
  return getPreference(PREFS_KEYS.defaultModel);
}

function getDefaultLength() {
  return getPreference(PREFS_KEYS.defaultLength);
}

// Returns a positive integer or the string "all".
function getItemsPerPage() {
  const v = getPreference(PREFS_KEYS.itemsPerPage);
  if (v === "all") return "all";
  if (v) {
    const n = parseInt(v, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_ITEMS_PER_PAGE;
}

// Populate the settings dialog's model select with the list from /models.
// Selection priority: saved preference > model.default from the API > first model.
function loadSettingsModels() {
  const $select = $("#prefs-default-model");
  if (!$select.length) return;

  $.ajax({
    url: "/models",
    method: "GET",
    success: function (data) {
      const savedModel = getDefaultModel();
      $select.empty();

      let fallbackValue = null;

      $.each(data.models, function (_, model) {
        const $option = $("<option>").val(model.id).text(model.name);
        $select.append($option);
        if (fallbackValue === null && model.default) {
          fallbackValue = model.id;
        }
      });

      if (fallbackValue === null && data.models.length > 0) {
        fallbackValue = data.models[0].id;
      }

      const effective =
        savedModel &&
        $select.find("option[value='" + savedModel + "']").length > 0
          ? savedModel
          : fallbackValue;

      if (effective) $select.val(effective);
    },
    error: function () {
      $select.html('<option value="">Error loading models</option>');
    },
  });
}

function loadSettingsLength() {
  const savedLength = getDefaultLength();
  if (savedLength && $("#prefs-default-length option[value='" + savedLength + "']").length) {
    $("#prefs-default-length").val(savedLength);
  }
  // else leave the first option selected by default
}

function loadSettingsItemsPerPage() {
  const saved = getItemsPerPage();
  const value = String(saved);
  if ($("#prefs-items-per-page option[value='" + value + "']").length) {
    $("#prefs-items-per-page").val(value);
  }
}

function formatUsd(n) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
  const v = Number(n);
  // Show more precision when the total is small (<$1) so rounding isn't confusing.
  return v >= 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(4)}`;
}

function formatCount(n) {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString();
}

function loadSettingsStats() {
  $("#stats-total-cost").text("…");
  $("#stats-total-summaries").text("…");
  $("#stats-total-tokens").text("…");
  $("#stats-priced-note").text("");

  $.ajax({
    url: "/stats",
    method: "GET",
    success: function (data) {
      $("#stats-total-cost").text(formatUsd(data.total_cost_usd));
      $("#stats-total-summaries").text(formatCount(data.total_summaries));
      const tokens =
        (Number(data.total_prompt_tokens) || 0) +
        (Number(data.total_completion_tokens) || 0);
      $("#stats-total-tokens").text(
        tokens
          ? `${formatCount(tokens)} (${formatCount(data.total_prompt_tokens)} in / ${formatCount(data.total_completion_tokens)} out)`
          : "—"
      );

      const priced = Number(data.priced_summaries) || 0;
      const total = Number(data.total_summaries) || 0;
      if (total > 0 && priced < total) {
        const missing = total - priced;
        $("#stats-priced-note").text(
          `${formatCount(missing)} summar${missing === 1 ? "y has" : "ies have"} no cost data (e.g. generated before tracking was added or via an unpriced provider).`
        );
      } else {
        $("#stats-priced-note").text("");
      }
    },
    error: function () {
      $("#stats-total-cost").text("—");
      $("#stats-total-summaries").text("—");
      $("#stats-total-tokens").text("—");
      $("#stats-priced-note").text("Failed to load usage stats.");
    },
  });
}

function openSettings() {
  loadSettingsModels();
  loadSettingsLength();
  loadSettingsItemsPerPage();
  loadSettingsStats();
  openModal("settings-dialog");
}

function closeSettings() {
  closeModal("settings-dialog");
}

function saveSettings(e) {
  if (e && e.preventDefault) e.preventDefault();

  const model = $("#prefs-default-model").val();
  const length = $("#prefs-default-length").val();
  const itemsPerPage = $("#prefs-items-per-page").val();

  setPreference(PREFS_KEYS.defaultModel, model);
  setPreference(PREFS_KEYS.defaultLength, length);
  setPreference(PREFS_KEYS.itemsPerPage, itemsPerPage);

  // Apply immediately to the homepage form if present
  if (model && $("#model option[value='" + model + "']").length) {
    $("#model").val(model);
  }
  if (length && $("#length option[value='" + length + "']").length) {
    $("#length").val(length);
  }

  closeSettings();

  if (window.toast) toast("Settings saved", { type: "success" });

  // If on the homepage, reload so the server re-queries with the new per_page.
  if (window.location.pathname === "/" || window.location.pathname === "") {
    const params = new URLSearchParams(window.location.search);
    if (itemsPerPage) {
      params.set("per_page", itemsPerPage);
      params.set("page", "1");
    }
    const qs = params.toString();
    window.location.href = window.location.pathname + (qs ? "?" + qs : "");
  }
}

$(document).ready(function () {
  // On the homepage, if the URL doesn't already specify per_page,
  // redirect once using the saved (or default) items-per-page so the server
  // applies pagination consistently.
  if (window.location.pathname === "/" || window.location.pathname === "") {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("per_page")) {
      const perPage = getItemsPerPage();
      params.set("per_page", String(perPage));
      if (perPage !== "all" && !params.has("page")) params.set("page", "1");
      window.location.replace(
        window.location.pathname + "?" + params.toString()
      );
    }
  }
});
