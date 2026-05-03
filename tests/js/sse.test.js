import { describe, it, expect, vi } from "vitest";
import { parseSseEvent, consumeEventStream } from "../../static/js/modules/sse.js";

describe("parseSseEvent", () => {
  it("parses a typical event block", () => {
    const block = "event: chunk\ndata: {\"content\":\"hi\"}";
    expect(parseSseEvent(block)).toEqual({
      event: "chunk",
      data: { content: "hi" },
    });
  });

  it("defaults event name to message", () => {
    const block = "data: {\"x\":1}";
    expect(parseSseEvent(block)).toEqual({ event: "message", data: { x: 1 } });
  });

  it("returns null for blocks with no data lines", () => {
    expect(parseSseEvent("event: ping")).toBeNull();
  });

  it("falls back to raw string for non-JSON data", () => {
    const block = "event: hello\ndata: not-json-here";
    expect(parseSseEvent(block)).toEqual({ event: "hello", data: "not-json-here" });
  });
});

describe("consumeEventStream", () => {
  // Build a reader that yields the given Uint8Array chunks, done after.
  function makeReader(chunks) {
    let i = 0;
    return {
      read: () =>
        Promise.resolve(
          i < chunks.length
            ? { done: false, value: chunks[i++] }
            : { done: true, value: undefined }
        ),
    };
  }

  const encode = (s) => new TextEncoder().encode(s);

  it("dispatches meta, chunk, and done in order", async () => {
    const reader = makeReader([
      encode(
        "event: meta\ndata: {\"title\":\"T\"}\n\n" +
          "event: chunk\ndata: {\"content\":\"Hi\"}\n\n" +
          "event: done\ndata: {\"cached\":false}\n\n"
      ),
    ]);
    const onMeta = vi.fn();
    const onChunk = vi.fn();
    const onDone = vi.fn();
    await consumeEventStream(reader, { onMeta, onChunk, onDone });
    expect(onMeta).toHaveBeenCalledWith({ title: "T" });
    expect(onChunk).toHaveBeenCalledWith({ content: "Hi" });
    expect(onDone).toHaveBeenCalledWith({ cached: false });
  });

  it("tolerates an event split across chunks", async () => {
    const reader = makeReader([
      encode("event: chunk\ndata: {\"con"),
      encode("tent\":\"X\"}\n\n"),
    ]);
    const onChunk = vi.fn();
    await consumeEventStream(reader, { onChunk });
    expect(onChunk).toHaveBeenCalledWith({ content: "X" });
  });
});
