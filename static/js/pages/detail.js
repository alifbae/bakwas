/**
 * @module pages/detail
 *
 * Detail-page controller: render the stored markdown summary, handle the
 * "Regenerate" modal, and fire the regenerate request.
 *
 * Server-rendered values (summary text, video URL, current model/length)
 * are injected via `<script type="application/json">` tags and `data-*`
 * attributes on `#detail-meta`.
 */

import { openModal, closeModal } from "../modules/modal.js";
import { readJsonScript, escapeHtml } from "../modules/dom.js";
import { fetchModels, regenerateSummary } from "../modules/api.js";
import { renderMarkdown } from "../modules/markdown.js";

/**
 * Render markdown into the `#summary-content` element.
 *
 * @param {string | null | undefined} summaryText
 */
function renderSummary(summaryText) {
  const el = document.getElementById("summary-content");
  if (!el) return;
  el.innerHTML = renderMarkdown(summaryText);
}

/**
 * Populate the regenerate modal's model <select> from `/models`. Selects
 * the currently-used model (or the API-default) by default.
 *
 * @param {string} currentModel
 */
async function loadRegenerateModels(currentModel) {
  const modelSelect = document.getElementById("regenerate-model");
  if (!modelSelect) return;
  try {
    const data = await fetchModels();
    modelSelect.innerHTML = "";
    (data.models || []).forEach((model) => {
      const option = document.createElement("option");
      option.value = model.id;
      option.textContent = model.name;
      if (model.id === currentModel || model.default) {
        option.selected = true;
      }
      modelSelect.appendChild(option);
    });
  } catch (e) {
    console.error("Failed to load models for regenerate:", e);
  }
}

/**
 * Submit a regenerate request, show an inline success flash, then reload
 * the page so the server-rendered header picks up the new metadata.
 *
 * @param {string} videoUrl
 */
async function submitRegenerate(videoUrl) {
  const summaryEl = document.getElementById("summary-content");
  const modelSelect = document.getElementById("regenerate-model");
  const lengthSelect = document.getElementById("regenerate-length");
  if (!summaryEl || !modelSelect || !lengthSelect) return;

  const selectedModel = modelSelect.value;
  const selectedLength = lengthSelect.value;

  closeModal("regenerateModal");
  summaryEl.innerHTML = '<p aria-busy="true">Regenerating summary with AI...</p>';

  try {
    const data = await regenerateSummary({
      url: videoUrl,
      model: selectedModel,
      length: selectedLength,
      force: true,
    });
    renderSummary(data.summary);

    const success = document.createElement("p");
    success.setAttribute("role", "status");
    success.innerHTML = "<mark>✓ Summary regenerated and saved!</mark>";
    summaryEl.prepend(success);

    setTimeout(() => {
      success.style.transition = "opacity 0.4s";
      success.style.opacity = "0";
      setTimeout(() => success.remove(), 400);
    }, 3000);
    setTimeout(() => location.reload(), 3500);
  } catch (err) {
    summaryEl.innerHTML = `<p><mark>Error: ${escapeHtml(err.message || "Unknown error")}</mark></p>`;
  }
}

/** Wire the detail page: initial render + regenerate controls. */
export function initDetailPage() {
  const summaryEl = document.getElementById("summary-content");
  if (!summaryEl) return;

  // Initial summary render from the <script type="application/json"> blob.
  const initialSummary = readJsonScript("summary-data");
  if (initialSummary !== null) {
    renderSummary(initialSummary);
  } else {
    summaryEl.innerHTML = "<p><mark>No summary data available</mark></p>";
  }

  // Server-provided values from <div id="detail-meta" data-*>.
  const meta = document.getElementById("detail-meta");
  const currentModel = meta?.dataset.currentModel || "";
  const currentLength = meta?.dataset.currentLength || "short";

  // Populate models and seed length.
  loadRegenerateModels(currentModel);
  const lengthSelect = document.getElementById("regenerate-length");
  if (lengthSelect) lengthSelect.value = currentLength;

  const regenerateBtn = document.getElementById("regenerateBtn");
  if (regenerateBtn) {
    regenerateBtn.addEventListener("click", () => openModal("regenerateModal"));
  }

  const confirmRegenerate = document.getElementById("confirmRegenerate");
  if (confirmRegenerate) {
    confirmRegenerate.addEventListener("click", () => {
      const videoUrl = readJsonScript("video-url");
      if (!videoUrl) {
        alert("Video URL not found");
        return;
      }
      submitRegenerate(videoUrl);
    });
  }
}

// Auto-run when this module is imported on the detail page.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDetailPage);
} else {
  initDetailPage();
}
