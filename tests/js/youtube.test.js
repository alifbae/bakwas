import { describe, it, expect } from "vitest";
import { extractYouTubeId } from "../../static/js/modules/youtube.js";

describe("extractYouTubeId", () => {
  it("parses watch URLs", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ"
    );
  });

  it("parses youtu.be URLs", () => {
    expect(extractYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("parses /shorts/", () => {
    expect(extractYouTubeId("https://www.youtube.com/shorts/abc123")).toBe("abc123");
  });

  it("parses /embed/", () => {
    expect(extractYouTubeId("https://www.youtube.com/embed/abc123")).toBe("abc123");
  });

  it("parses mobile URLs", () => {
    expect(extractYouTubeId("https://m.youtube.com/watch?v=xyz")).toBe("xyz");
  });

  it("returns null for non-YouTube URLs", () => {
    expect(extractYouTubeId("https://example.com/watch?v=abc")).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(extractYouTubeId("not a url")).toBeNull();
    expect(extractYouTubeId("")).toBeNull();
    expect(extractYouTubeId(null)).toBeNull();
  });
});
