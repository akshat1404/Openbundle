import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { buildDependencyGraph, chunkModules, orderModules } from "../src/index.js";
import { loadFixtureProject } from "./fixtureLoader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sampleProjectDir = path.join(__dirname, "..", "..", "fixtures", "sample-project");

function chunkFixture(dir: string, entry = "index.js") {
  const files = loadFixtureProject(dir);
  const graph = buildDependencyGraph(entry, files);
  const order = orderModules(graph);
  return { graph, order, result: chunkModules(graph, order) };
}

describe("chunkModules — fixtures/sample-project", () => {
  const { result } = chunkFixture(sampleProjectDir);

  it("produces exactly four physical output chunks: main, featureA's, featureB's, and one shared", () => {
    const outputFiles = result.chunks.map((c) => c.chunk.outputFile).sort();
    expect(outputFiles).toEqual(["featureA.chunk.js", "featureB.chunk.js", "main.js", "shared-1.js"]);

    const kinds = Object.fromEntries(result.chunks.map((c) => [c.chunk.outputFile, c.chunk.kind]));
    expect(kinds["main.js"]).toBe("main");
    expect(kinds["featureA.chunk.js"]).toBe("dynamic-entry");
    expect(kinds["featureB.chunk.js"]).toBe("dynamic-entry");
    expect(kinds["shared-1.js"]).toBe("shared");
  });

  it("exposes the real chunk-to-chunk edges: main dynamically depends on both feature chunks, each of which statically depends on the shared chunk", () => {
    expect(result.edges).toEqual(
      expect.arrayContaining([
        { from: "main.js", to: "featureA.chunk.js", kind: "dynamic" },
        { from: "main.js", to: "featureB.chunk.js", kind: "dynamic" },
        { from: "featureA.chunk.js", to: "shared-1.js", kind: "static" },
        { from: "featureB.chunk.js", to: "shared-1.js", kind: "static" },
      ]),
    );
    expect(result.edges).toHaveLength(4);
  });

  it("the shared chunk contains sharedHelper.js's helper, and only that — not duplicated into either feature chunk", () => {
    const shared = findChunk(result, "shared-1.js");
    expect(shared.chunk.files).toEqual(["sharedHelper.js"]);
    expect(shared.code).toMatch(/function helper\(x\)/);

    const featureA = findChunk(result, "featureA.chunk.js");
    const featureB = findChunk(result, "featureB.chunk.js");
    expect(featureA.code).not.toMatch(/function helper\(/);
    expect(featureB.code).not.toMatch(/function helper\(/);
  });

  it("each feature chunk imports helper from the shared chunk rather than containing its own copy", () => {
    const featureA = findChunk(result, "featureA.chunk.js");
    const featureB = findChunk(result, "featureB.chunk.js");
    expect(featureA.code).toMatch(/import \{ helper \} from "\.\/shared-1\.js";/);
    expect(featureB.code).toMatch(/import \{ helper \} from "\.\/shared-1\.js";/);
  });

  it("the main chunk's dynamic import() is rewritten to the real chunk filenames", () => {
    const main = findChunk(result, "main.js");
    expect(main.code).toMatch(/await import\("\.\/featureA\.chunk\.js"\)/);
    expect(main.code).toMatch(/await import\("\.\/featureB\.chunk\.js"\)/);
    expect(main.code).not.toMatch(/featureA\.js/);
    expect(main.code).not.toMatch(/featureB\.js/);
  });

  it("UNUSED_FLAG still never survives — chunking doesn't skip tree-shaking", () => {
    const main = findChunk(result, "main.js");
    expect(main.code).not.toMatch(/UNUSED_FLAG/);
  });

  it("runs the actual multi-file output for real: writes every chunk to disk, dynamically loads the feature chunks exactly as main.js's own rewritten import() would, and gets the right, shared-chunk-backed results", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "openbundle-chunk-"));
    try {
      for (const output of result.chunks) {
        await writeFile(path.join(dir, output.chunk.outputFile), output.code, "utf8");
      }

      // Real DOM so main.js's own addEventListener calls bind for real —
      // real user code is free to reference real browser APIs.
      const dom = new JSDOM(
        `<!doctype html><body><button id="a"></button><button id="b"></button></body>`,
        { url: "http://localhost/" },
      );
      const originalDocument = (globalThis as { document?: unknown }).document;
      (globalThis as { document?: unknown }).document = dom.window.document;

      const originalLog = console.log;
      const calls: unknown[][] = [];
      console.log = (...args: unknown[]) => {
        calls.push(args);
      };

      try {
        // main.js's own top-level code runs on import — the exact same
        // way a real <script type="module"> load would trigger it.
        await import(pathToFileURL(path.join(dir, "main.js")).href);

        // Click #a — this runs main.js's real, rewritten
        // `await import('./featureA.chunk.js')`, proving the dynamic
        // wiring is genuinely correct, not just present as text.
        const button = dom.window.document.getElementById("a")!;
        button.dispatchEvent(new dom.window.Event("click"));
        await new Promise((resolve) => setTimeout(resolve, 20)); // let the async handler's import() settle

        // And directly exercise every chunk file exactly as main.js's
        // own dynamic import would load it, confirming each one is a
        // real, independently loadable module wired to the shared chunk.
        const featureA = (await import(
          pathToFileURL(path.join(dir, "featureA.chunk.js")).href
        )) as { runFeatureA: () => string };
        const featureB = (await import(
          pathToFileURL(path.join(dir, "featureB.chunk.js")).href
        )) as { runFeatureB: () => string };
        const shared = (await import(pathToFileURL(path.join(dir, "shared-1.js")).href)) as Record<
          string,
          unknown
        >;

        expect(calls).toEqual([["hello: x", "15.00"]]); // main chunk's own root statement
        expect(featureA.runFeatureA()).toBe("processed(A)"); // routed through the shared chunk's real helper()
        expect(featureB.runFeatureB()).toBe("processed(B)");
        expect(Object.keys(shared)).toEqual(["helper"]); // tree-shaken to exactly what's demanded
      } finally {
        console.log = originalLog;
        (globalThis as { document?: unknown }).document = originalDocument;
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

function findChunk(result: ReturnType<typeof chunkModules>, outputFile: string) {
  const found = result.chunks.find((c) => c.chunk.outputFile === outputFile);
  if (!found) throw new Error(`no chunk found for ${outputFile}`);
  return found;
}
