/**
 * Openbundle core engine entry point.
 *
 * Stage 4: real parsing (@babel/parser + @babel/traverse), dependency-
 * graph resolution, topological ordering, and scope-based merge with
 * collision renaming. Tree-shaking and chunking land in later stages.
 */
export function ping(): string {
  return "openbundle-core: ready";
}

export { parseModule } from "./parse.js";
export type {
  ImportRecord,
  ImportSpecifierRecord,
  ParsedModule,
  TopLevelDeclarationRecord,
} from "./parse.js";

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

export { mergeModules } from "./merge.js";
export type { MergeCollision, MergeResult } from "./merge.js";
