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

  function handleFilesSelected(files: SampleFile[]) {
    setActiveProject(files);
    setUsingSample(false);
    setGraph(null);
    setResolveError(null);
  }

  function resetToSample() {
    setActiveProject(SAMPLE_PROJECT);
    setUsingSample(true);
    setGraph(null);
    setResolveError(null);
  }

  function handleEntryConfirmed(entryPath: string) {
    try {
      const files = toProjectFiles(activeProject);
      setGraph(buildDependencyGraph(entryPath, files));
      setResolveError(null);
    } catch (err) {
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
        <PipelineStages graph={graph} error={resolveError} />
      </section>
    </main>
  );
}
