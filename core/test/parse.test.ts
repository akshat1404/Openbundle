import { describe, expect, it } from "vitest";
import { parseModule } from "../src/index.js";

describe("parseModule", () => {
  it("captures static and dynamic imports as distinct kinds", () => {
    const source = `
      import { a } from './a.js';
      const b = await import('./b.js');
    `;
    const { imports } = parseModule(source, "entry.js");

    expect(imports).toContainEqual({ source: "./a.js", kind: "static" });
    expect(imports).toContainEqual({ source: "./b.js", kind: "dynamic" });
  });

  it("collects top-level declarations of every shape, not just function/const", () => {
    const source = `
      function plainFn() {}
      class PlainClass {}
      let plainLet = 1;
      const { destructured, renamed: alias } = {};
      export function exportedFn() {}
      export const exportedConst = 1;
      export default class DefaultClass {}
    `;
    const { topLevelDeclarations } = parseModule(source, "shapes.js");
    const names = topLevelDeclarations.map((d) => d.name);

    expect(names).toEqual(
      expect.arrayContaining([
        "plainFn",
        "PlainClass",
        "plainLet",
        "destructured",
        "alias",
        "exportedFn",
        "exportedConst",
        "DefaultClass",
      ]),
    );

    const exportedFn = topLevelDeclarations.find((d) => d.name === "exportedFn");
    const plainFn = topLevelDeclarations.find((d) => d.name === "plainFn");
    expect(exportedFn?.exported).toBe(true);
    expect(plainFn?.exported).toBe(false);
  });

  it("exposes top-level scope bindings via @babel/traverse", () => {
    const source = `
      const topLevel = 1;
      function outer() {
        const shadowed = 2;
      }
    `;
    const { boundNames } = parseModule(source, "scope.js");

    expect(boundNames).toContain("topLevel");
    expect(boundNames).toContain("outer");
    expect(boundNames).not.toContain("shadowed");
  });
});
