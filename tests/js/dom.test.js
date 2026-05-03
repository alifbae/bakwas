import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  readJsonScript,
  cloneTemplate,
} from "../../static/js/modules/dom.js";

describe("escapeHtml", () => {
  it("escapes the five required characters", () => {
    expect(escapeHtml("<a href=\"x\">& 'b'</a>")).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp; &#39;b&#39;&lt;/a&gt;"
    );
  });

  it("coerces non-strings", () => {
    expect(escapeHtml(42)).toBe("42");
    expect(escapeHtml(null)).toBe("null");
  });
});

describe("readJsonScript", () => {
  it("parses a JSON script block", () => {
    document.body.innerHTML =
      '<script type="application/json" id="x">{"a":1}</script>';
    expect(readJsonScript("x")).toEqual({ a: 1 });
  });

  it("returns null on missing element", () => {
    document.body.innerHTML = "";
    expect(readJsonScript("nope")).toBeNull();
  });

  it("returns null on parse failure", () => {
    document.body.innerHTML =
      '<script type="application/json" id="bad">{not:json}</script>';
    expect(readJsonScript("bad")).toBeNull();
  });
});

describe("cloneTemplate", () => {
  it("clones a template's content", () => {
    document.body.innerHTML = '<template id="t"><div class="x">hi</div></template>';
    const frag = cloneTemplate("t");
    expect(frag.querySelector(".x").textContent).toBe("hi");
  });

  it("throws for missing templates", () => {
    document.body.innerHTML = "";
    expect(() => cloneTemplate("nope")).toThrow(/Missing <template id/);
  });
});
