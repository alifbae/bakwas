/**
 * @module youtube
 *
 * YouTube URL parsing and oEmbed metadata fetch. Pure functions plus one
 * network helper. No DOM knowledge.
 *
 * Consumers: pages/index.js.
 */

/**
 * Extract a YouTube video ID from any supported URL form.
 *
 * Accepts: `youtu.be/ID`, `youtube.com/watch?v=ID`, `/shorts/ID`,
 * `/embed/ID`, `/live/ID`.
 *
 * @param {string | null | undefined} raw
 * @returns {string | null} the video ID, or `null` if not recognized.
 */
export function extractYouTubeId(raw) {
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

/**
 * @typedef {object} OEmbedResult
 * @property {string | null} title
 * @property {string | null} author
 */

/**
 * Fetch title + author via YouTube's oEmbed through the public noembed
 * proxy (CORS-friendly, no API key). Never throws.
 *
 * @param {string} videoId
 * @returns {Promise<OEmbedResult | null>} `null` on failure / missing data.
 */
export async function fetchYouTubeOEmbed(videoId) {
  if (!videoId) return null;
  try {
    const response = await fetch(
      `https://noembed.com/embed?url=https://youtu.be/${encodeURIComponent(videoId)}`
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || data.error) return null;
    return {
      title: data.title || null,
      author: data.author_name || null,
    };
  } catch (_) {
    return null;
  }
}
