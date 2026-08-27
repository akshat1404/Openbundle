/**
 * Built-in sample project shown by default, before any upload.
 * Loaded at build time from fixtures/sample-project/, the single
 * on-disk copy of this source (core's tests read the same files
 * directly off disk — see fixtures' Test Fixtures section in
 * PROJECT_BRIEF.md).
 */
export interface SampleFile {
  path: string;
  contents: string;
}

const modules = import.meta.glob("../../fixtures/sample-project/*.js", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

export const SAMPLE_PROJECT: SampleFile[] = Object.entries(modules)
  .map(([filePath, contents]) => ({
    path: filePath.split("/").pop()!,
    contents,
  }))
  .sort((a, b) => a.path.localeCompare(b.path));
