// Convert server-rendered UTC timestamps to the user's local time.
// Templates mark up cells with data-utc-time / data-utc-date; we rewrite
// textContent on init.

export function formatLocalDateTime(utcDateString) {
  if (!utcDateString) return "N/A";
  try {
    const date = new Date(utcDateString + "Z"); // server emits naive UTC
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_) {
    return utcDateString;
  }
}

export function formatLocalDate(utcDateString) {
  if (!utcDateString) return "N/A";
  try {
    const date = new Date(utcDateString + "Z");
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (_) {
    return utcDateString;
  }
}

export function initDateTime() {
  document.querySelectorAll("[data-utc-time]").forEach((el) => {
    const utc = el.getAttribute("data-utc-time");
    el.textContent = formatLocalDateTime(utc);
  });
  document.querySelectorAll("[data-utc-date]").forEach((el) => {
    const utc = el.getAttribute("data-utc-date");
    el.textContent = formatLocalDate(utc);
  });
}
