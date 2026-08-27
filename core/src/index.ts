/**
 * Openbundle core engine entry point.
 *
 * Stage 2: real parsing (@babel/parser + @babel/traverse) and dependency-
 * graph resolution. Ordering, merge, tree-shaking, and chunking land in
 * later stages.
 */
export function ping(): string {
  return "openbundle-core: ready";
}

export { parseModule } from "./parse.js";
export type { ImportRecord, ParsedModule, TopLevelDeclarationRecord } from "./parse.js";

export { isExternalSpecifier, resolveRelativeImport } from "./resolvePath.js";

export { buildDependencyGraph } from "./graph.js";
export type {
  DependencyGraph,
  ExternalGraphNode,
  GraphEdge,
  GraphNode,
  LocalGraphNode,
  ProjectFiles,
} from "./graph.js";
