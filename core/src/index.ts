/**
 * Openbundle core engine entry point.
 *
 * Stage 1 (scaffolding): no bundling logic yet. This placeholder exists
 * only to prove the package boundary and test runner work end to end.
 * Real exports (resolve, order, merge, treeShake, chunk) land in later stages.
 */
export function ping(): string {
  return "openbundle-core: ready";
}
