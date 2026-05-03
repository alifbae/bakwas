// Small DOM/utility helpers shared across modules.

/**
 * Escape a string for safe insertion into HTML. Use sparingly — prefer
 * textContent / element construction where possible.
 */
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/** Read and JSON-parse a <script type="application/json" id="..."> block. */
export function readJsonScript(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  try {
    return JSON.parse(el.textContent);
  } catch (e) {
    console.error("Failed to parse JSON from #" + id, e);
    return null;
  }
}

/**
 * Robust mac detection: prefer userAgentData when available, fall back to
 * navigator.platform / userAgent. Covers macOS on Intel and Apple Silicon.
 */
export function isMacPlatform() {
  const ua = navigator.userAgentData;
  if (ua && typeof ua.platform === "string") {
    return ua.platform.toLowerCase().includes("mac");
  }
  const legacy = (navigator.platform || "") + " " + (navigator.userAgent || "");
  return /mac/i.test(legacy);
}
