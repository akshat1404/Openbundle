import type { DependencyGraph } from "./graph.js";

/**
 * Real dependencies-before-dependents order for every local file in the
 * graph — a topological sort over static edges only.
 *
 * Dynamic import() edges don't force ordering the same way a static
 * import does: the dynamically-imported file doesn't need to already be
 * written before the import() call site for that call to be valid (which
 * chunk it lands in is stage 6's concern, not this one). A dynamically
 * imported file's own static dependencies still get ordered correctly
 * relative to it — only the dynamic edge itself is excluded as a
 * constraint.
 *
 * External nodes are skipped: they're never written as output, but their
 * presence in the graph is never an error.
 */
export function orderModules(graph: DependencyGraph): string[] {
  const localIds = [...graph.nodes.keys()].filter((id) => graph.nodes.get(id)!.kind === "local");
  const localSet = new Set(localIds);

  // "before" edges: dependency -> importer. A node's in-degree is how
  // many of its own static dependencies haven't been emitted yet.
  const dependents = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const id of localIds) inDegree.set(id, 0);

  const seenOrderEdges = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.kind !== "static") continue;
    if (!localSet.has(edge.from) || !localSet.has(edge.to)) continue; // external target: no ordering constraint

    // Two import statements between the same pair of files (e.g. two
    // separate named imports) are still one ordering constraint.
    const key = `${edge.to}->${edge.from}`;
    if (seenOrderEdges.has(key)) continue;
    seenOrderEdges.add(key);

    if (!dependents.has(edge.to)) dependents.set(edge.to, []);
    dependents.get(edge.to)!.push(edge.from);
    inDegree.set(edge.from, (inDegree.get(edge.from) ?? 0) + 1);
  }

  // Kahn's algorithm, seeded and re-fed in the graph's own node order for
  // a deterministic result.
  const queue = localIds.filter((id) => inDegree.get(id) === 0);
  const order: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const dependent of dependents.get(id) ?? []) {
      const remaining = inDegree.get(dependent)! - 1;
      inDegree.set(dependent, remaining);
      if (remaining === 0) queue.push(dependent);
    }
  }

  if (order.length !== localIds.length) {
    const unresolved = localIds.filter((id) => !order.includes(id));
    throw new Error(`Openbundle: circular static import detected among: ${unresolved.join(", ")}`);
  }

  return order;
}
