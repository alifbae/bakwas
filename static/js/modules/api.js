/**
 * @module api
 *
 * Single source of truth for backend API calls. Centralizes endpoint URLs,
 * request shape, and error handling. Every function throws on non-2xx
 * responses with a message extracted from the JSON body when possible,
 * so callers only need one `try/catch`.
 */

import { consumeEventStream } from "./sse.js";

/**
 * Error thrown by any `api.js` function on a non-2xx response.
 * The HTTP status is attached as `.status`.
 */
class ApiError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   */
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Best-effort extraction of a human-readable error message from a
 * failed response. Falls back to the supplied default.
 * @param {Response} response
 * @param {string} [fallback="Request failed"]
 * @returns {Promise<string>}
 */
async function readError(response, fallback = "Request failed") {
  try {
    const body = await response.json();
    return body?.error || fallback;
  } catch (_) {
    return fallback;
  }
}

/**
 * GET a JSON endpoint. Throws `ApiError` on non-2xx.
 * @param {string} path
 * @returns {Promise<*>}
 */
async function getJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new ApiError(await readError(response), response.status);
  }
  return response.json();
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

/**
 * GET /models — list available LLM models.
 * @returns {Promise<{ models: Array<{id:string, name:string, default?:boolean}> }>}
 */
export function fetchModels() {
  return getJson("/models");
}

/**
 * GET /stats — aggregate cost/token stats.
 * @returns {Promise<object>}
 */
export function fetchStats() {
  return getJson("/stats");
}

/**
 * GET /search — summaries for the command palette.
 * @returns {Promise<{ summaries: Array<{id:string, title:string, creator?:string, url:string}> }>}
 */
export function fetchSearchIndex() {
  return getJson("/search");
}

/**
 * @typedef {object} SummarizeRequest
 * @property {string} url
 * @property {string} model
 * @property {string} length
 * @property {boolean} [force=true] - bypass the server cache.
 */

/**
 * POST /summarize — non-streaming summarize (or regenerate with force=true).
 *
 * @param {SummarizeRequest} req
 * @returns {Promise<object>} the parsed response body on success.
 */
export async function regenerateSummary({ url, model, length, force = true }) {
  const body = new URLSearchParams({
    url,
    model,
    length,
    force: force ? "true" : "false",
  });
  const response = await fetch("/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!response.ok) {
    throw new ApiError(await readError(response), response.status);
  }
  return response.json();
}

/**
 * POST /summarize/stream — start an SSE summarize request and dispatch
 * events to the supplied handlers.
 *
 * Resolves when the stream ends. Throws `ApiError` before streaming begins
 * if the request fails to open (e.g. 4xx / 5xx on the initial POST).
 *
 * @param {Omit<SummarizeRequest, "force">} req
 * @param {import("./sse.js").SseHandlers} handlers
 * @returns {Promise<void>}
 */
export async function streamSummarize({ url, model, length }, handlers) {
  const body = new URLSearchParams({ url, model, length });
  const response = await fetch("/summarize/stream", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!response.ok) {
    throw new ApiError(await readError(response), response.status);
  }
  return consumeEventStream(response.body.getReader(), handlers);
}

export { ApiError };
