import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildDependencyGraph, mergeModules, orderModules } from "../src/index.js";
import { loadFixtureProject } from "./fixtureLoader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sampleProjectDir = path.join(__dirname, "..", "..", "fixtures", "sample-project");
const mergeCollisionsDir = path.join(__dirname, "..", "..", "fixtures", "merge-collisions");

describe("mergeModules — fixtures/sample-project", () => {
  const files = loadFixtureProject(sampleProjectDir);
  const graph = buildDependencyGraph("index.js", files);
  const order = orderModules(graph);
  const result = mergeModules(graph, order);

  it("renames utilsB.js's colliding format to format$1, and rewrites its own reference", () => {
    expect(result.collisions).toEqual([
      { name: "format", file: "utilsB.js", renamedTo: "format$1" },
    ]);

    // utilsA.js keeps the plain name (first in stage 3's order) — its
    // own declaration and its own call site both stay "format".
    expect(result.code).toMatch(/function format\(n\)/);
    expect(result.code).toMatch(/format\(x \+ SOME_VALUE\)/);

    // utilsB.js's declaration and its own call site are both renamed —
    // a real reference rewrite, not a leftover call to the old name.
    expect(result.code).toMatch(/function format\$1\(name\)/);
    expect(result.code).toMatch(/format\$1\(name\)/);
    expect(result.code).not.toMatch(/return format\(name\)/);
  });

  it("preserves stage 3's ordering exactly in the generated output", () => {
    const markerPositions = order.map((file) => result.code.indexOf(`// ${file}`));
    expect(markerPositions.every((pos) => pos !== -1)).toBe(true);
    const sorted = [...markerPositions].sort((a, b) => a - b);
    expect(markerPositions).toEqual(sorted);
    expect(result.fileOrder).toEqual(order);
  });
});

describe("mergeModules — fixtures/merge-collisions", () => {
  const files = loadFixtureProject(mergeCollisionsDir);
  const graph = buildDependencyGraph("index.js", files);
  const order = orderModules(graph);
  const result = mergeModules(graph, order);

  it("renames b.js's colliding shared, updating only its own real reference", () => {
    expect(result.collisions).toEqual([{ name: "shared", file: "b.js", renamedTo: "shared$1" }]);
    expect(result.code).toMatch(/function shared\$1\(\)/);
    expect(result.code).toMatch(/return shared\$1\(\);/); // helperB's own call site, rewritten
  });

  it("THE key guarantee: c.js's own unrelated declaration survives completely untouched", () => {
    // c.js's local variable `shared`, nested inside useShared(), was never
    // a collision candidate (it's not a top-level binding) and must stay
    // exactly as written — a naive text-based rename (the bug that broke
    // the first attempt) would have caught this too.
    expect(result.code).toMatch(/const shared = 5;/);
    expect(result.code).toMatch(/return shared \* 2;/);
    expect(result.code).not.toMatch(/const shared\$1/);
  });

  it("never renames a property key or string literal that merely spells the colliding name", () => {
    expect(result.code).toMatch(/shared: 'not the function'/);
    expect(result.code).toMatch(/label: 'shared'/);
    expect(result.code).not.toMatch(/shared\$1: 'not the function'/);
    expect(result.code).not.toMatch(/label: 'shared\$1'/);
  });

  it("a.js, the winner of the collision, keeps its original name untouched", () => {
    expect(result.code).toMatch(/function shared\(\)/);
    expect(result.code).toMatch(/return shared\(\);/); // helperA's own call site
  });
});
