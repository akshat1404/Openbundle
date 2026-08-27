import { parseModule, type ParsedModule } from "./parse.js";
import { isExternalSpecifier, resolveRelativeImport } from "./resolvePath.js";

/**
 * A project's files as project-relative path -> source text.
 * Populated from a fixture directory in tests, or from an uploaded
 * file list in the browser. Core never reads the filesystem itself.
 */
export type ProjectFiles = Map<string, string>;

export interface LocalGraphNode {
  kind: "local";
  path: string;
  module: ParsedModule;
}

/**
 * A bare specifier that resolution refuses to open, per the scope
 * boundary: kept as a real node in the graph, never parsed or walked into.
 */
export interface ExternalGraphNode {
  kind: "external";
  specifier: string;
}

export type GraphNode = LocalGraphNode | ExternalGraphNode;

export interface GraphEdge {
  from: string;
  to: string;
  kind: "static" | "dynamic";
}

export interface DependencyGraph {
  entry: string;
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
}

/**
 * Walk every static and dynamic import reachable from `entry`, building
 * the real dependency graph. A file reachable more than once is only
 * ever parsed once. Relative imports are resolved and walked; bare
 * specifiers become external nodes and are never opened.
 */
export function buildDependencyGraph(entry: string, files: ProjectFiles): DependencyGraph {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const queue: string[] = [entry];

  while (queue.length > 0) {
    const currentPath = queue.shift()!;
    if (nodes.has(currentPath)) continue; // dedupe: already visited/parsed

    const source = files.get(currentPath);
    if (source === undefined) {
      throw new Error(`Openbundle: cannot resolve "${currentPath}", file not found in project`);
    }

    const module = parseModule(source, currentPath);
    nodes.set(currentPath, { kind: "local", path: currentPath, module });

    for (const imp of module.imports) {
      if (isExternalSpecifier(imp.source)) {
        if (!nodes.has(imp.source)) {
          nodes.set(imp.source, { kind: "external", specifier: imp.source });
        }
        edges.push({ from: currentPath, to: imp.source, kind: imp.kind });
        continue;
      }

      const resolved = resolveRelativeImport(currentPath, imp.source);
      edges.push({ from: currentPath, to: resolved, kind: imp.kind });
      if (!nodes.has(resolved)) {
        queue.push(resolved);
      }
    }
  }

  return { entry, nodes, edges };
}
