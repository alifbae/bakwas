import { describe, it, expect, beforeEach } from "vitest";

// Import from the module under test. The module uses modal/api/toast, but
// the accessor functions we test here (get*) only touch localStorage.
import {
  getDefaultModel,
  getDefaultLength,
  getItemsPerPage,
} from "../../static/js/modules/preferences.js";

describe("preferences accessors", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when no default model is saved", () => {
    expect(getDefaultModel()).toBeNull();
  });

  it("returns the saved default model", () => {
    localStorage.setItem("bakwas.defaultModel", "openai/gpt-4o-mini");
    expect(getDefaultModel()).toBe("openai/gpt-4o-mini");
  });

  it("returns the saved length", () => {
    localStorage.setItem("bakwas.defaultLength", "comprehensive");
    expect(getDefaultLength()).toBe("comprehensive");
  });

  it("defaults items per page to 10 when unset", () => {
    expect(getItemsPerPage()).toBe(10);
  });

  it("preserves 'all' as a string", () => {
    localStorage.setItem("bakwas.itemsPerPage", "all");
    expect(getItemsPerPage()).toBe("all");
  });

  it("falls back to default for invalid saved values", () => {
    localStorage.setItem("bakwas.itemsPerPage", "nonsense");
    expect(getItemsPerPage()).toBe(10);
  });
});
