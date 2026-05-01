// Detail page: render markdown summary, handle regenerate modal, and back button.
// Server-rendered values (summary text, video URL, current model/length, index URL)
// are injected via <script type="application/json"> tags and data-* attributes.

function readJsonScript(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  try {
    return JSON.parse(el.textContent);
  } catch (e) {
    console.error("Failed to parse JSON from #" + id, e);
    return null;
  }
}

$(document).ready(function () {
  const $summaryContent = $("#summary-content");

  function renderSummary(summaryText) {
    try {
      const renderedMarkdown = marked.parse(summaryText);
      $summaryContent.html(renderedMarkdown);
    } catch (e) {
      console.error("Error parsing summary:", e);
      $summaryContent.html(
        "<p><mark>Error rendering summary: " + e.message + "</mark></p>"
      );
    }
  }

  // Initial summary render
  const initialSummary = readJsonScript("summary-data");
  if (initialSummary !== null) {
    renderSummary(initialSummary);
  } else {
    $summaryContent.html("<p><mark>No summary data available</mark></p>");
  }

  // Server-provided values
  const $meta = $("#detail-meta");
  const currentModel = $meta.data("current-model") || "";
  const currentLength = $meta.data("current-length") || "short";
  const indexUrl = $meta.data("index-url") || "/";

  // Load models into regenerate modal
  function loadRegenerateModels() {
    $.ajax({
      url: "/models",
      method: "GET",
      success: function (data) {
        const $modelSelect = $("#regenerate-model");
        $modelSelect.empty();

        $.each(data.models, function (index, model) {
          const $option = $("<option>").val(model.id).text(model.name);

          if (model.id === currentModel || model.default) {
            $option.prop("selected", true);
          }

          $modelSelect.append($option);
        });
      },
    });
  }

  loadRegenerateModels();

  // Set current length in modal
  $("#regenerate-length").val(currentLength);

  // Open regenerate modal
  $("#regenerateBtn").on("click", function () {
    openModal("regenerateModal");
  });

  // Confirm regeneration (force=true bypasses the cache)
  $("#confirmRegenerate").on("click", function () {
    const videoUrl = readJsonScript("video-url");
    if (!videoUrl) {
      alert("Video URL not found");
      return;
    }

    const selectedModel = $("#regenerate-model").val();
    const selectedLength = $("#regenerate-length").val();

    closeModal("regenerateModal");

    $summaryContent.html(
      '<p aria-busy="true">Regenerating summary with AI...</p>'
    );

    $.ajax({
      url: "/summarize",
      method: "POST",
      data: {
        url: videoUrl,
        model: selectedModel,
        length: selectedLength,
        force: "true",
      },
      success: function (data) {
        renderSummary(data.summary);

        const $success = $("<p>")
          .attr("role", "status")
          .html("<mark>✓ Summary regenerated and saved!</mark>");
        $summaryContent.prepend($success);
        setTimeout(() => $success.fadeOut(), 3000);
        setTimeout(() => location.reload(), 3500);
      },
      error: function (xhr) {
        const error = xhr.responseJSON ? xhr.responseJSON.error : "Unknown error";
        $summaryContent.html(`<p><mark>Error: ${error}</mark></p>`);
      },
    });
  });

  // Back button handler
  $("#backButton").on("click", function () {
    window.location.href = indexUrl;
  });
});
