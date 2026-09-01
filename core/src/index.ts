/**
 * Openbundle core engine entry point.
 *
 * Stage 3: real parsing (@babel/parser + @babel/traverse), dependency-
 * graph resolution, and topological ordering. Merge, tree-shaking, and
 * chunking land in later stages.
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

export { orderModules } from "./order.js";
