import { useState } from "react";
import { buildDependencyGraph, orderModules, type DependencyGraph } from "openbundle-core";
import { FileUpload } from "./FileUpload.js";
import { EntryPointConfirm } from "./EntryPointConfirm.js";
import { PipelineStages } from "./PipelineStages.js";
import { SAMPLE_PROJECT, type SampleFile } from "./sampleProject.js";
import { toProjectFiles } from "./projectFiles.js";

export function App() {
  const [activeProject, setActiveProject] = useState<SampleFile[]>(SAMPLE_PROJECT);
  const [usingSample, setUsingSample] = useState(true);

  const [graph, setGraph] = useState<DependencyGraph | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolveDurationMs, setResolveDurationMs] = useState<number | null>(null);

  const [order, setOrder] = useState<string[] | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderDurationMs, setOrderDurationMs] = useState<number | null>(null);

  function resetPipelineState() {
    setGraph(null);
    setResolveError(null);
    setResolveDurationMs(null);
    setOrder(null);
    setOrderError(null);
    setOrderDurationMs(null);
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
    const resolveStart = performance.now();
    try {
      const nextGraph = buildDependencyGraph(entryPath, files);
      setResolveDurationMs(performance.now() - resolveStart);
      setGraph(nextGraph);
      setResolveError(null);

      // Ordering is a pure derivation of the graph resolution just
      // produced — it runs immediately, same as resolve did.
      const orderStart = performance.now();
      try {
        const nextOrder = orderModules(nextGraph);
        setOrderDurationMs(performance.now() - orderStart);
        setOrder(nextOrder);
        setOrderError(null);
      } catch (err) {
        setOrderDurationMs(performance.now() - orderStart);
        setOrder(null);
        setOrderError(err instanceof Error ? err.message : String(err));
      }
    } catch (err) {
      setResolveDurationMs(performance.now() - resolveStart);
      setGraph(null);
      setResolveError(err instanceof Error ? err.message : String(err));
      setOrder(null);
      setOrderError(null);
      setOrderDurationMs(null);
    }
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
        />
      </section>
    </main>
  );
}
