/**
 * @module sse
 *
 * Server-Sent Events helpers. Pure protocol handling — no DOM knowledge.
 *
 * @example
 * await consumeEventStream(response.body.getReader(), {
 *   onMeta:  (data) => { ... },
 *   onChunk: (data) => { ... },
 *   onDone:  (data) => { ... },
 *   onError: (data) => { ... },
 *   onEvent: (name, data) => { ... },  // optional catch-all
 * });
 */

/**
 * @typedef {object} SseEvent
 * @property {string} event - event name, defaults to `"message"`.
 * @property {*} data - JSON-parsed data if parseable, else the raw string.
 */

/**
 * @typedef {object} SseHandlers
 * @property {(data: *) => void} [onMeta]
 * @property {(data: *) => void} [onChunk]
 * @property {(data: *) => void} [onDone]
 * @property {(data: *) => void} [onError]
 * @property {(name: string, data: *) => void} [onEvent]
 */

/**
 * Parse one SSE event block (the text between two blank lines).
 *
 * @param {string} block
 * @returns {SseEvent | null} null if the block had no `data:` lines.
 */
export function parseSseEvent(block) {
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

/**
 * Consume a ReadableStream of SSE events, dispatching to handlers.
 *
 * @param {ReadableStreamDefaultReader<Uint8Array>} reader
 * @param {SseHandlers} [handlers]
 * @returns {Promise<void>} resolves when the stream ends.
 */
export async function consumeEventStream(reader, handlers = {}) {
  const decoder = new TextDecoder();
  let buffer = "";

  const dispatch = (ev) => {
    if (!ev) return;
    if (ev.event === "meta" && handlers.onMeta) handlers.onMeta(ev.data);
    else if (ev.event === "chunk" && handlers.onChunk) handlers.onChunk(ev.data);
    else if (ev.event === "done" && handlers.onDone) handlers.onDone(ev.data);
    else if (ev.event === "error" && handlers.onError) handlers.onError(ev.data);
    if (handlers.onEvent) handlers.onEvent(ev.event, ev.data);
  };

  const flush = () => {
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      dispatch(parseSseEvent(raw));
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      if (buffer.length) flush();
      return;
    }
    buffer += decoder.decode(value, { stream: true });
    flush();
  }
}
