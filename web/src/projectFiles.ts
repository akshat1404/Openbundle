import type { ProjectFiles } from "openbundle-core";
import type { SampleFile } from "./sampleProject.js";

/**
 * Convert the uploaded/sample file list into the flat, project-relative
 * ProjectFiles map core expects. A folder upload (webkitdirectory) yields
 * paths prefixed with the selected folder's own name (e.g.
 * "myproject/index.js") — strip that shared root so paths line up with
 * the relative import specifiers inside the files themselves.
 */
export function toProjectFiles(files: SampleFile[]): ProjectFiles {
  const stripped = stripCommonRoot(files);
  return new Map(stripped.map((f) => [f.path, f.contents]));
}

function stripCommonRoot(files: SampleFile[]): SampleFile[] {
  if (files.length === 0 || !files.every((f) => f.path.includes("/"))) return files;

  const firstSegment = files[0].path.split("/")[0];
  const shareRoot = files.every((f) => f.path.split("/")[0] === firstSegment);
  if (!shareRoot) return files;

  return files.map((f) => ({ ...f, path: f.path.split("/").slice(1).join("/") }));
}
