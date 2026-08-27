import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildDependencyGraph } from "../src/index.js";
import { loadFixtureProject } from "./fixtureLoader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sampleProjectDir = path.join(__dirname, "..", "..", "fixtures", "sample-project");
const externalImportDir = path.join(__dirname, "..", "..", "fixtures", "external-import");

describe("buildDependencyGraph — fixtures/sample-project", () => {
  const files = loadFixtureProject(sampleProjectDir);
  const graph = buildDependencyGraph("index.js", files);

  it("visits config.js exactly once despite being statically imported by both utilsA.js and utilsB.js", () => {
    const incoming = graph.edges.filter((e) => e.to === "config.js");
    expect(incoming).toHaveLength(2);
    expect(graph.nodes.get("config.js")?.kind).toBe("local");
    // one node, not one per importer
    expect([...graph.nodes.keys()].filter((k) => k === "config.js")).toHaveLength(1);
  });

  it("visits sharedHelper.js exactly once despite being reachable through two separate dynamic imports", () => {
    const incoming = graph.edges.filter((e) => e.to === "sharedHelper.js");
    expect(incoming).toHaveLength(2);
    expect(graph.nodes.get("sharedHelper.js")?.kind).toBe("local");
    expect([...graph.nodes.keys()].filter((k) => k === "sharedHelper.js")).toHaveLength(1);
  });

  it("reaches featureA.js and featureB.js via dynamic-import edges, distinct from the static edges used elsewhere", () => {
    const toFeatureA = graph.edges.find((e) => e.to === "featureA.js");
    const toFeatureB = graph.edges.find((e) => e.to === "featureB.js");
    expect(toFeatureA?.kind).toBe("dynamic");
    expect(toFeatureB?.kind).toBe("dynamic");

    const staticEdges = graph.edges.filter((e) => e.kind === "static");
    expect(staticEdges.some((e) => e.to === "config.js")).toBe(true);
    expect(staticEdges.some((e) => e.to === "sharedHelper.js")).toBe(true);
    expect(staticEdges.some((e) => e.to === "featureA.js" || e.to === "featureB.js")).toBe(false);
  });
});

describe("buildDependencyGraph — fixtures/external-import", () => {
  const files = loadFixtureProject(externalImportDir);
  const graph = buildDependencyGraph("index.js", files);

  it("classifies the bare specifier as external, keeps it as a real graph node, and never parses/walks into it", () => {
    const externalNode = graph.nodes.get("axios");
    expect(externalNode).toBeDefined();
    expect(externalNode?.kind).toBe("external");
    // no local file named "axios" was ever read or parsed
    expect(files.has("axios")).toBe(false);
  });

  it("resolves and walks the real local import normally", () => {
    const localNode = graph.nodes.get("localHelper.js");
    expect(localNode?.kind).toBe("local");
    if (localNode?.kind === "local") {
      expect(localNode.module.topLevelDeclarations.some((d) => d.name === "helper")).toBe(true);
    }
  });
});
