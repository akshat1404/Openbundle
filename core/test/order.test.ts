import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildDependencyGraph, orderModules } from "../src/index.js";
import { loadFixtureProject } from "./fixtureLoader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sampleProjectDir = path.join(__dirname, "..", "..", "fixtures", "sample-project");
const externalImportDir = path.join(__dirname, "..", "..", "fixtures", "external-import");

describe("orderModules — fixtures/sample-project", () => {
  const files = loadFixtureProject(sampleProjectDir);
  const graph = buildDependencyGraph("index.js", files);
  const order = orderModules(graph);

  it("includes every local file exactly once", () => {
    expect(order).toHaveLength(7);
    expect(new Set(order).size).toBe(7);
  });

  it("orders config.js before both utilsA.js and utilsB.js", () => {
    expect(order.indexOf("config.js")).toBeLessThan(order.indexOf("utilsA.js"));
    expect(order.indexOf("config.js")).toBeLessThan(order.indexOf("utilsB.js"));
  });

  it("orders sharedHelper.js before both featureA.js and featureB.js", () => {
    expect(order.indexOf("sharedHelper.js")).toBeLessThan(order.indexOf("featureA.js"));
    expect(order.indexOf("sharedHelper.js")).toBeLessThan(order.indexOf("featureB.js"));
  });

  it("places the entry point, index.js, last", () => {
    expect(order[order.length - 1]).toBe("index.js");
  });
});

describe("orderModules — fixtures/external-import", () => {
  it("skips the external node without erroring on its presence", () => {
    const files = loadFixtureProject(externalImportDir);
    const graph = buildDependencyGraph("index.js", files);
    const order = orderModules(graph);

    expect(order).toEqual(["localHelper.js", "index.js"]);
    expect(order).not.toContain("axios");
  });
});

describe("orderModules — circular static imports", () => {
  it("throws rather than silently producing a partial or wrong order", () => {
    const files = new Map([
      ["a.js", `import './b.js';\nexport const a = 1;\n`],
      ["b.js", `import './a.js';\nexport const b = 1;\n`],
    ]);
    const graph = buildDependencyGraph("a.js", files);

    expect(() => orderModules(graph)).toThrow(/circular static import/i);
  });
});
