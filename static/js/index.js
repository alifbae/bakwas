// Homepage: model loading, default preferences, and summary form submission.
// Depends on jQuery, marked, and preferences.js (getDefaultModel / getDefaultLength).

$(document).ready(function () {
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

  // Form submission
  $("#summaryForm").on("submit", function (e) {
    e.preventDefault();

    const url = $("#url").val();
    const model = $("#model").val();
    const length = $("#length").val();
    const $resultDiv = $("#result");

    $resultDiv
      .show()
      .html(
        '<div class="loading-state"><p aria-busy="true">Extracting captions and summarizing...</p></div>'
      );

    $.ajax({
      url: "/summarize",
      method: "POST",
      data: {
        url: url,
        model: model,
        length: length,
      },
      success: function (data) {
        const summaryHtml = marked.parse(data.summary);
        const modelName = data.model_used.split("/")[1];

        const $header = $('<header class="summary-meta">').html(`
                      <div><strong>Video:</strong> ${data.title}</div>
                      <div><strong>Creator:</strong> ${data.creator}</div>
                      <div><strong>Date:</strong> ${data.video_date}</div>
                      <div><strong>Length:</strong> <kbd>${data.summary_length}</kbd></div>
                      <div><strong>Model:</strong> <small>${modelName}</small></div>
                  `);

        const $content = $('<div class="markdown-content">').html(summaryHtml);

        const $footer = $("<footer>").html(`
                      <small>${data.caption_length} words extracted • ${data.cached ? 'Loaded from cache' : 'Saved to database'}</small><br>
                      <small><em>Refresh page to see in table below</em></small>
                  `);

        $resultDiv.empty().append($header).append($content).append($footer);
      },
      error: function (xhr) {
        const error = xhr.responseJSON ? xhr.responseJSON.error : "Unknown error";
        $resultDiv.html(`<p><mark>Error: ${error}</mark></p>`);
      },
    });
  });
});
