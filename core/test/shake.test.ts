import { fileURLToPath } from "node:url";
import path from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { buildDependencyGraph, mergeModules, orderModules, shakeModules } from "../src/index.js";
import { loadFixtureProject } from "./fixtureLoader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sampleProjectDir = path.join(__dirname, "..", "..", "fixtures", "sample-project");
const treeShakingDir = path.join(__dirname, "..", "..", "fixtures", "tree-shaking");

function shakeFixture(dir: string, entry = "index.js") {
  const files = loadFixtureProject(dir);
  const graph = buildDependencyGraph(entry, files);
  const order = orderModules(graph);
  const merged = mergeModules(graph, order);
  return { graph, merged, shaken: shakeModules(merged, graph.entry) };
}

/**
 * Real shaken output is free to reference real DOM APIs (it's whatever
 * the user's own code did) — jsdom, scoped to just this run, is what
 * gives `new Function` a real `document` to execute against, not a
 * hand-rolled stub standing in for one.
 */
function runAndCapture(code: string): unknown[][] {
  const originalLog = console.log;
  const originalDocument = (globalThis as { document?: unknown }).document;
  const dom = new JSDOM();
  (globalThis as { document?: unknown }).document = dom.window.document;

  const calls: unknown[][] = [];
  console.log = (...args: unknown[]) => {
    calls.push(args);
  };
  try {
    // eslint-disable-next-line no-new-func -- proving the shaken code is
    // real, runnable JS, not just text with the right identifiers left.
    new Function(code)();
  } finally {
    console.log = originalLog;
    (globalThis as { document?: unknown }).document = originalDocument;
  }
  return calls;
}

describe("shakeModules — fixtures/sample-project", () => {
  const { shaken } = shakeFixture(sampleProjectDir);

  it("UNUSED_FLAG is completely absent from the final output, provably never marked", () => {
    expect(shaken.code).not.toMatch(/UNUSED_FLAG/);
    expect(shaken.removed.some((r) => r.label === "UNUSED_FLAG" && r.reason === "unreferenced")).toBe(
      true,
    );
  });

  it("runs for real and produces the right result", () => {
    const calls = runAndCapture(shaken.code);
    expect(calls).toEqual([["hello: x", "15.00"]]);
  });
});

describe("shakeModules — fixtures/tree-shaking", () => {
  const { shaken } = shakeFixture(treeShakingDir);

  it("keeps a declaration reachable only transitively (index -> runA -> stepB -> stepC)", () => {
    // only runA is directly referenced from entry's own root statement —
    // proving the walk isn't just one level deep.
    expect(shaken.code).toMatch(/function runA\(\)/);
    expect(shaken.code).toMatch(/function stepB\(\)/);
    expect(shaken.code).toMatch(/function stepC\(\)/);
    expect(shaken.kept.map((k) => k.label)).toEqual(
      expect.arrayContaining(["runA", "stepB", "stepC"]),
    );
  });

  it("removes an unreferenced declaration", () => {
    expect(shaken.code).not.toMatch(/unusedHelper/);
    expect(shaken.removed.some((r) => r.label === "unusedHelper")).toBe(true);
  });

  it("removes a bare, side-effect-free expression statement", () => {
    expect(shaken.code).not.toMatch(/5 \+ 3/);
    expect(shaken.removed.some((r) => r.reason === "side-effect-free")).toBe(true);
  });

  it("keeps a bare statement with a real, unprovable side effect, by default", () => {
    expect(shaken.code).toMatch(/sideEffect\(\);/);
    expect(
      shaken.kept.some((k) => k.reason === "possible-side-effect" && k.label.includes("sideEffect")),
    ).toBe(true);
  });

  it("runs the final, shaken output for real and produces the right result", () => {
    const calls = runAndCapture(shaken.code);
    expect(calls).toEqual([
      ["result:", 3], // stepC()=1, stepB()=2, runA()=3
      ["side effect ran"],
    ]);
  });

  it("removes a dead statement's declaration too — a reference that doesn't itself survive can't keep anything alive", () => {
    // ONLY_USED_BY_DEAD_CODE is referenced only by `ONLY_USED_BY_DEAD_CODE * 2;`,
    // which is itself pure and gets removed. The reference dies with the
    // statement, so the declaration it pointed to was never really needed
    // either — matching real Rollup's output for the equivalent input.
    expect(shaken.code).not.toMatch(/ONLY_USED_BY_DEAD_CODE/);
    expect(
      shaken.removed.some((r) => r.label === "ONLY_USED_BY_DEAD_CODE" && r.reason === "unreferenced"),
    ).toBe(true);
    expect(
      shaken.removed.some((r) => r.reason === "side-effect-free" && r.label.includes("ONLY_USED_BY_DEAD_CODE")),
    ).toBe(true);
  });
});

describe("shakeModules — fixtures/external-import", () => {
  it("never removes an external import, reachability doesn't apply to it", () => {
    const externalImportDir = path.join(__dirname, "..", "..", "fixtures", "external-import");
    const { shaken } = shakeFixture(externalImportDir);

    expect(shaken.code).toMatch(/import axios from 'axios';/);
    expect(shaken.kept.some((k) => k.kind === "external-import")).toBe(true);
  });
});
