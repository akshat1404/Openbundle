/**
 * Openbundle core engine entry point.
 *
 * Stage 5: real parsing (@babel/parser + @babel/traverse), dependency-
 * graph resolution, topological ordering, scope-based merge with
 * collision renaming, and mark-and-sweep tree-shaking. Chunking lands
 * in a later stage.
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
export type { MergeCollision, MergedFileBlock, MergeResult } from "./merge.js";

export { shakeModules } from "./shake.js";
export type { ShakeItem, ShakeReason, ShakeResult } from "./shake.js";
