import { useState } from "react";
import { buildDependencyGraph, type DependencyGraph } from "openbundle-core";
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

  function handleFilesSelected(files: SampleFile[]) {
    setActiveProject(files);
    setUsingSample(false);
    setGraph(null);
    setResolveError(null);
    setResolveDurationMs(null);
  }

  function resetToSample() {
    setActiveProject(SAMPLE_PROJECT);
    setUsingSample(true);
    setGraph(null);
    setResolveError(null);
    setResolveDurationMs(null);
  }

  function handleEntryConfirmed(entryPath: string) {
    const files = toProjectFiles(activeProject);
    const start = performance.now();
    try {
      const nextGraph = buildDependencyGraph(entryPath, files);
      setResolveDurationMs(performance.now() - start);
      setGraph(nextGraph);
      setResolveError(null);
    } catch (err) {
      setResolveDurationMs(performance.now() - start);
      setGraph(null);
      setResolveError(err instanceof Error ? err.message : String(err));
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
        <PipelineStages graph={graph} error={resolveError} resolveDurationMs={resolveDurationMs} />
      </section>
    </main>
  );
}
