/**
 * Convert UTC timestamp to local time and format it
 */
function formatLocalDateTime(utcDateString) {
  if (!utcDateString) return "N/A";

  try {
    const date = new Date(utcDateString + "Z"); // Add Z to indicate UTC
    const options = {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    return date.toLocaleString(undefined, options);
  } catch (e) {
    return utcDateString;
  }
}

function formatLocalDate(utcDateString) {
  if (!utcDateString) return "N/A";

  try {
    const date = new Date(utcDateString + "Z");
    const options = {
      year: "numeric",
      month: "short",
      day: "numeric",
    };
    return date.toLocaleDateString(undefined, options);
  } catch (e) {
    return utcDateString;
  }
}

/**
 * Convert all timestamps on page load
 */
$(document).ready(function () {
  // Convert all elements with data-utc-time attribute
  $("[data-utc-time]").each(function () {
    const utcTime = $(this).data("utc-time");
    const formatted = formatLocalDateTime(utcTime);
    $(this).text(formatted);
  });

  // Convert all elements with data-utc-date attribute
  $("[data-utc-date]").each(function () {
    const utcDate = $(this).data("utc-date");
    const formatted = formatLocalDate(utcDate);
    $(this).text(formatted);
  });
});
