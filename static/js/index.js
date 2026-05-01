// Homepage:
//   - loads models and default preferences
//   - parses YouTube URLs on paste/input and shows a preview card
//   - streams summaries via Server-Sent Events with live Markdown rendering
//   - uses skeleton placeholders while waiting for first tokens
//   - surfaces toast notifications for success/error

function formatCostSuffix(data) {
  if (data.cost_usd === null || data.cost_usd === undefined) return "";
  const cost = Number(data.cost_usd);
  if (!Number.isFinite(cost)) return "";
  return ` • cost $${cost.toFixed(4)}`;
}

// Extract a YouTube video ID from a pasted URL.
// Accepts: youtu.be/ID, youtube.com/watch?v=ID, /shorts/ID, /embed/ID, /live/ID.
function extractYouTubeId(raw) {
  if (!raw || typeof raw !== "string") return null;
  let url;
  try {
    url = new URL(raw.trim());
  } catch (_) {
    return null;
  }

  const host = (url.hostname || "").toLowerCase();
  const path = url.pathname || "";

  if (host === "youtu.be") {
    const id = path.replace(/^\//, "").split("/")[0];
    return id || null;
  }

  if (
    host === "youtube.com" ||
    host === "www.youtube.com" ||
    host === "m.youtube.com"
  ) {
    if (path === "/watch") {
      return url.searchParams.get("v") || null;
    }
    const parts = path.split("/").filter(Boolean);
    if (parts.length >= 2 && ["shorts", "embed", "live"].includes(parts[0])) {
      return parts[1] || null;
    }
  }

  return null;
}

function renderUrlPreview($target, videoId) {
  if (!videoId) {
    $target.empty();
    return;
  }
  const thumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  $target.html(`
    <div class="url-preview">
      <img
        src="${thumb}"
        alt=""
        class="url-preview__thumb"
        loading="lazy"
      />
      <div class="url-preview__text">
        <div class="url-preview__title" data-role="title">Loading…</div>
        <div class="url-preview__meta" data-role="meta">Video ID: ${videoId}</div>
      </div>
    </div>
  `);

  // Fetch the real title + author from YouTube's oEmbed (via the public
  // noembed proxy so we stay CORS-friendly with no API key).
  fetch(`https://noembed.com/embed?url=https://youtu.be/${encodeURIComponent(videoId)}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data || data.error) return;
      const $title = $target.find('[data-role="title"]');
      const $meta = $target.find('[data-role="meta"]');
      if (data.title) $title.text(data.title);
      if (data.author_name) $meta.text(data.author_name);
    })
    .catch(() => {
      /* silently fail; thumbnail is still useful */
    });
}

function renderUrlPreviewError($target, message) {
  $target.html(`
    <div class="url-preview url-preview--error">
      <div class="url-preview__text">
        <div class="url-preview__title">Not a YouTube URL</div>
        <div class="url-preview__meta">${message}</div>
      </div>
    </div>
  `);
}

// Skeleton placeholder while waiting for the first streamed chunk.
function renderSkeleton() {
  return `
    <div class="skeleton-summary" aria-busy="true" aria-label="Generating summary">
      <div class="skeleton-line skeleton-line--title"></div>
      <div class="skeleton-line skeleton-line--md"></div>
      <div class="skeleton-line skeleton-line--lg"></div>
      <div class="skeleton-line skeleton-line--md"></div>
      <div class="skeleton-line skeleton-line--sm"></div>
      <div class="skeleton-line skeleton-line--md"></div>
      <div class="skeleton-line skeleton-line--xs"></div>
      <div class="skeleton-summary__status">Extracting captions…</div>
    </div>
  `;
}

function updateSkeletonStatus($resultDiv, message) {
  const $status = $resultDiv.find(".skeleton-summary__status");
  if ($status.length) $status.text(message);
}

$(document).ready(function () {
  // Auto-focus the URL input on initial load so the user can paste immediately.
  setTimeout(() => {
    const $url = $("#url");
    if ($url.length && !$url.is(":focus")) {
      $url.trigger("focus");
    }
  }, 50);

  // Load available models
  function loadModels() {
    $.ajax({
      url: "/models",
      method: "GET",
      success: function (data) {
        const $modelSelect = $("#model");
        $modelSelect.empty();

        const savedModel =
          typeof getDefaultModel === "function" ? getDefaultModel() : null;

        $.each(data.models, function (index, model) {
          const $option = $("<option>").val(model.id).text(model.name);
          if (savedModel ? model.id === savedModel : model.default) {
            $option.prop("selected", true);
          }
          $modelSelect.append($option);
        });
      },
      error: function () {
        $("#model").html('<option value="">Error loading models</option>');
      },
    });
  }

  loadModels();

  // Apply saved default length preference if present
  const savedLength =
    typeof getDefaultLength === "function" ? getDefaultLength() : null;
  if (savedLength && $("#length option[value='" + savedLength + "']").length) {
    $("#length").val(savedLength);
  }

  // URL preview appears below the form (not inside the grid row)
  const $url = $("#url");
  let $preview = $("#url-preview");
  if (!$preview.length) {
    $preview = $('<div id="url-preview"></div>');
    const $form = $("#summaryForm");
    if ($form.length) {
      $form.after($preview);
    } else {
      $url.after($preview);
    }
  }

  function handleUrlChange() {
    const raw = ($url.val() || "").trim();
    if (!raw) {
      $preview.empty();
      return;
    }
    const id = extractYouTubeId(raw);
    if (id) {
      renderUrlPreview($preview, id);
    } else {
      renderUrlPreviewError($preview, "Paste a youtube.com or youtu.be link.");
    }
  }

  $url.on("input paste", function () {
    // paste fires before the value is applied; defer one tick
    setTimeout(handleUrlChange, 0);
  });

  // Form submission — streaming path
  $("#summaryForm").on("submit", function (e) {
    e.preventDefault();

    const url = ($url.val() || "").trim();
    const model = $("#model").val();
    const length = $("#length").val();
    const $resultDiv = $("#result");

    if (!url) {
      if (window.toast) toast("Paste a YouTube URL first", { type: "error" });
      return;
    }

    $resultDiv.show().html(renderSkeleton());

    // POST to the streaming endpoint. The server replies with text/event-stream.
    const body = new URLSearchParams({ url, model, length });

    fetch("/summarize/stream", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    })
      .then(async (response) => {
        if (!response.ok) {
          let msg = "Request failed";
          try {
            const j = await response.json();
            msg = j.error || msg;
          } catch (_) {
            // non-JSON error body
          }
          throw new Error(msg);
        }
        return response.body.getReader();
      })
      .then((reader) => consumeStream(reader, $resultDiv))
      .catch((err) => {
        $resultDiv.html(
          `<p><mark>Error: ${err.message || "Unknown error"}</mark></p>`
        );
        if (window.toast) toast(err.message || "Summary failed", { type: "error" });
      });
  });
});

// ----------------------------------------------------------------------------
// SSE consumer: reads the stream, dispatches events to the UI.
// ----------------------------------------------------------------------------

function consumeStream(reader, $resultDiv) {
  const decoder = new TextDecoder();
  let buffer = "";
  let meta = null;
  let fullText = "";
  let firstChunkReceived = false;
  let $liveContent = null;
  let $meta = null;

  function flushEvents() {
    // SSE events are separated by a blank line.
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const event = parseSseEvent(raw);
      if (event) handleEvent(event);
    }
  }

  function handleEvent(ev) {
    if (ev.event === "meta") {
      meta = ev.data || {};
      return;
    }

    if (ev.event === "chunk") {
      if (!firstChunkReceived) {
        firstChunkReceived = true;
        // Replace skeleton with a live header + content block.
        const modelName = (meta.model_used || "").split("/")[1] || meta.model_used;
        $resultDiv.empty();
        $meta = $('<header class="summary-meta">').html(`
          <div><strong>Video:</strong> ${escapeHtml(meta.title || "")}</div>
          <div><strong>Creator:</strong> ${escapeHtml(meta.creator || "")}</div>
          <div><strong>Date:</strong> ${escapeHtml(meta.video_date || "")}</div>
          <div><strong>Length:</strong> ${escapeHtml(meta.summary_length || "")}</div>
          <div><strong>Model:</strong> <small>${escapeHtml(modelName || "")}</small></div>
        `);
        $liveContent = $('<div class="markdown-content"></div>');
        $resultDiv.append($meta).append($liveContent);
      }
      fullText += ev.data.content || "";
      // Re-render the full markdown each tick. For summaries of the size
      // we generate (a few KB), this is cheap and keeps formatting consistent.
      $liveContent.html(window.marked ? marked.parse(fullText) : escapeHtml(fullText));
      return;
    }

    if (ev.event === "done") {
      const data = ev.data || {};
      // Build the final footer with cost + persistence status.
      const captionWords = meta && meta.caption_length ? Number(meta.caption_length) : null;
      const footerLine = [
        captionWords ? `${captionWords.toLocaleString()} words extracted` : null,
        data.cached ? "Loaded from cache" : "Saved to database",
      ]
        .filter(Boolean)
        .join(" • ");

      const $footer = $("<footer>").html(`
        <small>${footerLine}${formatCostSuffix(data)}</small><br>
        <small><em>Refresh page to see in table below</em></small>
      `);

      if (!firstChunkReceived) {
        // Empty stream (shouldn't happen) — fall back to plain render.
        $resultDiv.empty();
      }
      $resultDiv.append($footer);

      if (window.toast) {
        toast(data.cached ? "Loaded from cache" : "Summary saved", {
          type: "success",
        });
      }
      return;
    }

    if (ev.event === "error") {
      const msg = (ev.data && ev.data.error) || "Summary failed";
      $resultDiv.html(`<p><mark>Error: ${escapeHtml(msg)}</mark></p>`);
      if (window.toast) toast(msg, { type: "error" });
      return;
    }
  }

  function pump() {
    return reader.read().then(({ done, value }) => {
      if (done) {
        // process any trailing buffer just in case
        if (buffer.length) flushEvents();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      flushEvents();

      // Update skeleton status after first non-chunk event (meta)
      if (!firstChunkReceived && meta) {
        updateSkeletonStatus($resultDiv, "Generating summary…");
      }

      return pump();
    });
  }

  return pump();
}

function parseSseEvent(block) {
  const lines = block.split("\n");
  let event = "message";
  const dataLines = [];
  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (!dataLines.length) return null;
  try {
    return { event, data: JSON.parse(dataLines.join("\n")) };
  } catch (_) {
    return { event, data: dataLines.join("\n") };
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
