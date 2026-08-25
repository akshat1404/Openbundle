import { useState } from "react";
import { ping } from "openbundle-core";
import { FileUpload } from "./FileUpload.js";
import { PipelineStages } from "./PipelineStages.js";
import { SAMPLE_PROJECT, type SampleFile } from "./sampleProject.js";

export function App() {
  const [activeProject, setActiveProject] = useState<SampleFile[]>(SAMPLE_PROJECT);
  const [usingSample, setUsingSample] = useState(true);

  function handleFilesSelected(files: SampleFile[]) {
    setActiveProject(files);
    setUsingSample(false);
  }

  function resetToSample() {
    setActiveProject(SAMPLE_PROJECT);
    setUsingSample(true);
  }

  return (
    <main className="app">
      <header className="app__header">
        <h1>Openbundle</h1>
        <p className="app__tagline">
          A real bundler with a visible engine. Everything below, parsing, resolution, and every
          later pipeline stage, runs entirely in your browser. Nothing you upload leaves this
          page. ({ping()})
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
        <h2>Pipeline</h2>
        <PipelineStages />
      </section>
    </main>
  );
}
