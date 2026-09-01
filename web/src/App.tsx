import { useState } from "react";
import {
  buildDependencyGraph,
  orderModules,
  mergeModules,
  type DependencyGraph,
  type MergeCollision,
} from "openbundle-core";
import { FileUpload } from "./FileUpload.js";
import { EntryPointConfirm } from "./EntryPointConfirm.js";
import { PipelineStages } from "./PipelineStages.js";
import { SAMPLE_PROJECT, type SampleFile } from "./sampleProject.js";
import { toProjectFiles } from "./projectFiles.js";
import { runTimed } from "./pipeline/runTimed.js";

export function App() {
  const [activeProject, setActiveProject] = useState<SampleFile[]>(SAMPLE_PROJECT);
  const [usingSample, setUsingSample] = useState(true);

  const [graph, setGraph] = useState<DependencyGraph | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolveDurationMs, setResolveDurationMs] = useState<number | null>(null);

  const [order, setOrder] = useState<string[] | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderDurationMs, setOrderDurationMs] = useState<number | null>(null);

  const [mergedCode, setMergedCode] = useState<string | null>(null);
  const [mergeCollisions, setMergeCollisions] = useState<MergeCollision[]>([]);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [mergeDurationMs, setMergeDurationMs] = useState<number | null>(null);

  function resetPipelineState() {
    setGraph(null);
    setResolveError(null);
    setResolveDurationMs(null);
    setOrder(null);
    setOrderError(null);
    setOrderDurationMs(null);
    setMergedCode(null);
    setMergeCollisions([]);
    setMergeError(null);
    setMergeDurationMs(null);
  }

  function handleFilesSelected(files: SampleFile[]) {
    setActiveProject(files);
    setUsingSample(false);
    resetPipelineState();
  }

  function resetToSample() {
    setActiveProject(SAMPLE_PROJECT);
    setUsingSample(true);
    resetPipelineState();
  }

  function handleEntryConfirmed(entryPath: string) {
    const files = toProjectFiles(activeProject);

    const resolveRun = runTimed(() => buildDependencyGraph(entryPath, files));
    setResolveDurationMs(resolveRun.durationMs);
    setGraph(resolveRun.value);
    setResolveError(resolveRun.error);
    if (!resolveRun.value) {
      setOrder(null);
      setOrderError(null);
      setOrderDurationMs(null);
      setMergedCode(null);
      setMergeCollisions([]);
      setMergeError(null);
      setMergeDurationMs(null);
      return;
    }
    const resolvedGraph = resolveRun.value;

    // Ordering and merge are pure derivations of the graph resolve just
    // produced — each runs immediately, same click, each timed for real.
    const orderRun = runTimed(() => orderModules(resolvedGraph));
    setOrderDurationMs(orderRun.durationMs);
    setOrder(orderRun.value);
    setOrderError(orderRun.error);
    if (!orderRun.value) {
      setMergedCode(null);
      setMergeCollisions([]);
      setMergeError(null);
      setMergeDurationMs(null);
      return;
    }

    const mergeRun = runTimed(() => mergeModules(resolvedGraph, orderRun.value!));
    setMergeDurationMs(mergeRun.durationMs);
    setMergedCode(mergeRun.value?.code ?? null);
    setMergeCollisions(mergeRun.value?.collisions ?? []);
    setMergeError(mergeRun.error);
  }

  return (
    <main className="app">
      <header className="app__header">
        <h1>Openbundle</h1>
        <p className="app__tagline">
          A real bundler with a visible engine. Everything below, parsing, resolution, and every
          later pipeline stage, runs entirely in your browser. Nothing you upload leaves this
          page.
        </p>
      </header>

      <section className="app__section">
        <h2>Project</h2>
        <FileUpload onFilesSelected={handleFilesSelected} />
        {!usingSample && (
          <button type="button" onClick={resetToSample}>
            Use built-in sample instead
          </button>
        )}
        <p className="app__project-label">
          {usingSample ? "Showing built-in sample project:" : "Showing uploaded project:"}
        </p>
        <ul className="app__file-list">
          {activeProject.map((file) => (
            <li key={file.path}>{file.path}</li>
          ))}
        </ul>
      </section>

      <section className="app__section">
        <h2>Entry point</h2>
        <EntryPointConfirm key={usingSample ? "sample" : "uploaded"} files={activeProject} onConfirm={handleEntryConfirmed} />
      </section>

      <section className="app__section">
        <h2>Pipeline</h2>
        <PipelineStages
          graph={graph}
          resolveError={resolveError}
          resolveDurationMs={resolveDurationMs}
          order={order}
          orderError={orderError}
          orderDurationMs={orderDurationMs}
          mergedCode={mergedCode}
          mergeCollisions={mergeCollisions}
          mergeError={mergeError}
          mergeDurationMs={mergeDurationMs}
        />
      </section>
    </main>
  );
}
