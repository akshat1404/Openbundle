import type { SampleFile } from "./sampleProject.js";

const CONVENTIONAL_ENTRY_CANDIDATES = ["index.js", "src/index.js"];

/**
 * Best-effort entry-point guess: package.json's "main" field first,
 * then conventional filenames. Never authoritative on its own — the
 * caller must still show this to the user for confirmation.
 */
export function detectEntryPoint(files: SampleFile[]): string | null {
  const byPath = new Map(files.map((f) => [f.path, f.contents]));

  const pkgJson = byPath.get("package.json");
  if (pkgJson) {
    try {
      const parsed = JSON.parse(pkgJson) as { main?: unknown };
      if (typeof parsed.main === "string") {
        const normalized = normalizeEntryPath(parsed.main);
        if (byPath.has(normalized)) return normalized;
      }
    } catch {
      // malformed package.json — fall through to conventional names
    }
  }

  for (const candidate of CONVENTIONAL_ENTRY_CANDIDATES) {
    if (byPath.has(candidate)) return candidate;
  }

  return null;
}

function normalizeEntryPath(mainField: string): string {
  return mainField.replace(/^\.\//, "");
}
