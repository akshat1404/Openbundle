import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ProjectFiles } from "../src/index.js";

/**
 * Load a flat fixture directory (fixtures/*) into the same
 * ProjectFiles shape the engine consumes: project-relative path -> source.
 */
export function loadFixtureProject(dir: string): ProjectFiles {
  const files: ProjectFiles = new Map();
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith(".js")) continue;
    files.set(entry, readFileSync(join(dir, entry), "utf8"));
  }
  return files;
}
