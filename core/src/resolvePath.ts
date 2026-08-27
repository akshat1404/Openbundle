/**
 * Import-specifier classification and relative-path resolution.
 * ESM only, relative specifiers only (`./`, `../`); anything else is external.
 * No node_modules resolution, no package.json main/exports logic — out of scope.
 */

export function isExternalSpecifier(specifier: string): boolean {
  return !(specifier.startsWith("./") || specifier.startsWith("../"));
}

/**
 * Resolve a relative import specifier against the file that imports it.
 * Pure POSIX-style path math over the flat, project-relative path keys
 * this engine uses everywhere (e.g. "featureA.js", "utils/helpers.js").
 */
export function resolveRelativeImport(fromPath: string, specifier: string): string {
  const fromDir = fromPath.includes("/") ? fromPath.slice(0, fromPath.lastIndexOf("/")) : "";
  const segments = (fromDir ? fromDir.split("/") : []).concat(specifier.split("/"));

  const resolved: string[] = [];
  for (const segment of segments) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      resolved.pop();
      continue;
    }
    resolved.push(segment);
  }

  return resolved.join("/");
}
