import { describe, expect, it } from "vitest";
import { isExternalSpecifier, resolveRelativeImport } from "../src/index.js";

describe("isExternalSpecifier", () => {
  it("treats bare specifiers as external", () => {
    expect(isExternalSpecifier("axios")).toBe(true);
    expect(isExternalSpecifier("lodash/debounce")).toBe(true);
  });

  it("treats relative specifiers as not external", () => {
    expect(isExternalSpecifier("./a.js")).toBe(false);
    expect(isExternalSpecifier("../a.js")).toBe(false);
  });
});

describe("resolveRelativeImport", () => {
  it("resolves a sibling import", () => {
    expect(resolveRelativeImport("index.js", "./utils.js")).toBe("utils.js");
  });

  it("resolves within a subdirectory", () => {
    expect(resolveRelativeImport("src/index.js", "./utils.js")).toBe("src/utils.js");
  });

  it("resolves a parent-directory import", () => {
    expect(resolveRelativeImport("src/features/a.js", "../shared.js")).toBe("src/shared.js");
  });
});
