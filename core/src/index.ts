/**
 * Openbundle core engine entry point.
 *
 * Stage 6: real parsing (@babel/parser + @babel/traverse), dependency-
 * graph resolution, topological ordering, scope-based merge with
 * collision renaming, mark-and-sweep tree-shaking, and chunking —
 * dynamic-import boundaries and shared-chunk extraction, each chunk
 * merged and shaken on its own.
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
export type {
  ExternalChunkTarget,
  MergeCollision,
  MergedFileBlock,
  MergeOptions,
  MergeResult,
} from "./merge.js";

export { shakeModules } from "./shake.js";
export type { ShakeItem, ShakeOptions, ShakeReason, ShakeResult } from "./shake.js";

export { chunkModules } from "./chunk.js";
export type { Chunk, ChunkEdge, ChunkKind, ChunkOutput, ChunkResult } from "./chunk.js";
