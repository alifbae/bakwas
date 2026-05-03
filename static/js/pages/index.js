// Homepage:
//   - loads models and default preferences
//   - parses YouTube URLs on paste/input and shows a preview card
//   - streams summaries via Server-Sent Events with live Markdown rendering
//   - uses skeleton placeholders while waiting for first tokens
//   - surfaces toast notifications for success/error
//
// Static HTML lives in <template> elements in templates/index.html; JS
// clones them and populates [data-field="…"] nodes via textContent.

/**
 * @module pages/index
 *
 * Homepage controller: model + preference loading, YouTube URL preview,
 * streaming summarization via Server-Sent Events, and markdown rendering.
 *
 * HTML for dynamic sections (skeleton, URL preview, meta header, footer)
 * lives in `<template>` elements in `templates/index.html`; this module
 * clones them and fills `[data-field="…"]` nodes via `textContent`.
 */

import { escapeHtml, cloneTemplate } from "../modules/dom.js";
import { toast } from "../modules/toast.js";
import { getDefaultModel, getDefaultLength } from "../modules/preferences.js";
import { extractYouTubeId, fetchYouTubeOEmbed } from "../modules/youtube.js";
import { fetchModels, streamSummarize } from "../modules/api.js";

// ---------------------------------------------------------------------------
// Template-rendering helpers
// ---------------------------------------------------------------------------

/**
 * Fill a template fragment's `[data-field="key"]` nodes from an object of
 * text values. Unknown fields are ignored; missing fields leave the
 * template's default text intact.
 *
 * @param {DocumentFragment} fragment
 * @param {Record<string, string | number | null | undefined>} values
 * @returns {DocumentFragment}
 */
function fillFields(fragment, values) {
  for (const [key, value] of Object.entries(values)) {
    const node = fragment.querySelector(`[data-field="${key}"]`);
    if (node && value != null) node.textContent = value;
  }
  return fragment;
}

// ---------------------------------------------------------------------------
// URL preview card
// ---------------------------------------------------------------------------

/**
 * Render the YouTube URL preview card (thumbnail + title + author) into
 * `target`. Shows "Loading…" until the oEmbed response resolves; leaves
 * the thumbnail alone if oEmbed fails (it's still informative on its own).
 *
 * @param {HTMLElement} target
 * @param {string} videoId
 */
function renderUrlPreview(target, videoId) {
  if (!videoId) {
    target.replaceChildren();
    return;
  }
  const frag = cloneTemplate("tpl-url-preview");
  const thumb = frag.querySelector('[data-field="thumb"]');
  if (thumb) thumb.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  fillFields(frag, { meta: `Video ID: ${videoId}` });

  target.replaceChildren(frag);

  // Overlay real title + author from oEmbed once it resolves.
  fetchYouTubeOEmbed(videoId).then((data) => {
    if (!data) return;
    const title = target.querySelector('[data-field="title"]');
    const meta = target.querySelector('[data-field="meta"]');
    if (title && data.title) title.textContent = data.title;
    if (meta && data.author) meta.textContent = data.author;
  });
}

/**
 * Render the "not a YouTube URL" message into `target`.
 * @param {HTMLElement} target
 * @param {string} message
 */
function renderUrlPreviewError(target, message) {
  const frag = cloneTemplate("tpl-url-preview-error");
  fillFields(frag, { message });
  target.replaceChildren(frag);
}

// ---------------------------------------------------------------------------
// Skeleton / live summary rendering
// ---------------------------------------------------------------------------

/**
 * Replace `resultDiv`'s contents with a fresh skeleton placeholder.
 * @param {HTMLElement} resultDiv
 */
function renderSkeletonInto(resultDiv) {
  resultDiv.replaceChildren(cloneTemplate("tpl-skeleton"));
}

/**
 * Update the skeleton's status text in place (doesn't replace DOM).
 * @param {HTMLElement} resultEl
 * @param {string} message
 */
function updateSkeletonStatus(resultEl, message) {
  const status = resultEl.querySelector(".skeleton-summary__status");
  if (status) status.textContent = message;
}

/**
 * Build a `<header>` element summarizing the video being processed.
 * @param {object} meta - SSE `meta` event payload.
 * @returns {HTMLElement}
 */
function renderMetaHeader(meta) {
  const modelName = (meta.model_used || "").split("/")[1] || meta.model_used;
  const frag = cloneTemplate("tpl-summary-meta");
  fillFields(frag, {
    title: meta.title || "",
    creator: meta.creator || "",
    video_date: meta.video_date || "",
    summary_length: meta.summary_length || "",
    model: modelName || "",
  });
  // <template> fragments are DocumentFragments; return the single root element
  // so the caller has something to position relative to siblings.
  return frag.firstElementChild;
}

/**
 * Format a cost suffix for the summary footer, or empty string if the cost
 * is unknown.
 * @param {{ cost_usd?: number | null }} data
 * @returns {string}
 */
function formatCostSuffix(data) {
  if (data.cost_usd === null || data.cost_usd === undefined) return "";
  const cost = Number(data.cost_usd);
  if (!Number.isFinite(cost)) return "";
  return ` • cost ${cost.toFixed(4)}`;
}

/**
 * Build the final `<footer>` with the word count and persistence status.
 * @param {object} meta
 * @param {object} data
 * @returns {HTMLElement}
 */
function renderFooter(meta, data) {
  const captionWords =
    meta && meta.caption_length ? Number(meta.caption_length) : null;
  const summaryLine = [
    captionWords ? `${captionWords.toLocaleString()} words extracted` : null,
    data.cached ? "Loaded from cache" : "Saved to database",
  ]
    .filter(Boolean)
    .join(" • ");

  const frag = cloneTemplate("tpl-summary-footer");
  fillFields(frag, { summary: summaryLine + formatCostSuffix(data) });
  return frag.firstElementChild;
}

/**
 * Render text as markdown via `window.marked` if available, else fall back
 * to plain (escaped) text.
 * @param {string} text
 * @returns {string}
 */
function renderMarkdown(text) {
  return window.marked ? window.marked.parse(text) : escapeHtml(text);
}

// ---------------------------------------------------------------------------
// Form init
// ---------------------------------------------------------------------------

/** Populate the model <select> from the server and apply saved default. */
async function populateModels() {
  const modelSelect = document.getElementById("model");
  if (!modelSelect) return;

  try {
    const data = await fetchModels();
    modelSelect.innerHTML = "";
    const savedModel = getDefaultModel();

    (data.models || []).forEach((model) => {
      const option = document.createElement("option");
      option.value = model.id;
      option.textContent = model.name;
      if (savedModel ? model.id === savedModel : model.default) {
        option.selected = true;
      }
      modelSelect.appendChild(option);
    });
  } catch (_) {
    modelSelect.innerHTML = '<option value="">Error loading models</option>';
  }
}

/** Apply the saved "default length" preference to the length <select>. */
function applySavedLength() {
  const lengthSelect = document.getElementById("length");
  if (!lengthSelect) return;
  const savedLength = getDefaultLength();
  if (
    savedLength &&
    lengthSelect.querySelector(`option[value="${CSS.escape(savedLength)}"]`)
  ) {
    lengthSelect.value = savedLength;
  }
}

/**
 * Wire the URL input: insert a preview container, re-render on input/paste.
 * @param {HTMLInputElement} urlInput
 * @param {HTMLElement} form
 */
function initUrlPreview(urlInput, form) {
  let preview = document.getElementById("url-preview");
  if (!preview) {
    preview = document.createElement("div");
    preview.id = "url-preview";
    form.after(preview);
  }

  function refresh() {
    const raw = (urlInput.value || "").trim();
    if (!raw) {
      preview.replaceChildren();
      return;
    }
    const id = extractYouTubeId(raw);
    if (id) {
      renderUrlPreview(preview, id);
    } else {
      renderUrlPreviewError(preview, "Paste a youtube.com or youtu.be link.");
    }
  }

  // paste fires before the value is applied; defer one tick.
  urlInput.addEventListener("input", () => setTimeout(refresh, 0));
  urlInput.addEventListener("paste", () => setTimeout(refresh, 0));
}

// ---------------------------------------------------------------------------
// Streaming submit handler
// ---------------------------------------------------------------------------

/**
 * Build a fresh set of SSE handlers scoped to a single submit. Keeps the
 * per-request state (meta, accumulated text, first-chunk flag) closure-local
 * so nothing leaks between requests.
 *
 * @param {HTMLElement} resultDiv
 * @returns {import("../modules/sse.js").SseHandlers}
 */
function buildStreamHandlers(resultDiv) {
  // Per-request state. Scoped here so each submit gets a fresh closure.
  let meta = null;
  let fullText = "";
  let firstChunkReceived = false;
  let liveContent = null;

  return {
    onMeta: (data) => {
      meta = data || {};
      // Update skeleton status while we wait for the first chunk.
      updateSkeletonStatus(resultDiv, "Generating summary…");
    },

    onChunk: (data) => {
      if (!firstChunkReceived) {
        firstChunkReceived = true;
        resultDiv.replaceChildren();
        liveContent = document.createElement("div");
        liveContent.className = "markdown-content";
        resultDiv.append(renderMetaHeader(meta || {}), liveContent);
      }
      fullText += data.content || "";
      // Re-render the full markdown each tick. For summaries of the size
      // we generate (a few KB), this is cheap and keeps formatting consistent.
      liveContent.innerHTML = renderMarkdown(fullText);
    },

    onDone: (data) => {
      if (!firstChunkReceived) {
        // Empty stream (shouldn't happen) — fall back to plain render.
        resultDiv.replaceChildren();
      }
      resultDiv.appendChild(renderFooter(meta, data || {}));
      toast(data?.cached ? "Loaded from cache" : "Summary saved", {
        type: "success",
      });
    },

    onError: (data) => {
      const msg = (data && data.error) || "Summary failed";
      resultDiv.innerHTML = `<p><mark>Error: ${escapeHtml(msg)}</mark></p>`;
      toast(msg, { type: "error" });
    },
  };
}

/**
 * Handle form submit: validate input, show skeleton, open stream, render.
 * @param {HTMLInputElement} urlInput
 * @param {HTMLElement} resultDiv
 */
async function handleSubmit(urlInput, resultDiv) {
  const url = (urlInput.value || "").trim();
  const model = document.getElementById("model").value;
  const length = document.getElementById("length").value;

  if (!url) {
    toast("Paste a YouTube URL first", { type: "error" });
    return;
  }

  resultDiv.style.display = "";
  renderSkeletonInto(resultDiv);

  try {
    await streamSummarize({ url, model, length }, buildStreamHandlers(resultDiv));
  } catch (err) {
    resultDiv.innerHTML = `<p><mark>Error: ${escapeHtml(err.message || "Unknown error")}</mark></p>`;
    toast(err.message || "Summary failed", { type: "error" });
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

/** Wire the homepage — idempotent, safe to call on DOMContentLoaded. */
function initHomepage() {
  const urlInput = document.getElementById("url");
  const form = document.getElementById("summaryForm");
  const resultDiv = document.getElementById("result");
  if (!urlInput || !form || !resultDiv) return;

  // Auto-focus URL input on initial load so the user can paste immediately.
  setTimeout(() => {
    if (document.activeElement !== urlInput) urlInput.focus();
  }, 50);

  populateModels();
  applySavedLength();
  initUrlPreview(urlInput, form);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    handleSubmit(urlInput, resultDiv);
  });
}

// Auto-run when this module is imported on the homepage.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHomepage);
} else {
  initHomepage();
}
