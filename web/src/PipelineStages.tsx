import type { DependencyGraph } from "openbundle-core";

const LATER_STAGES = [
  { key: "ordering", label: "Ordering", description: "Topological sort" },
  { key: "merge", label: "Merge", description: "Scope-hoisted, collision-renamed single scope" },
  { key: "treeShaking", label: "Tree-shaking", description: "Mark-and-sweep reachability" },
  { key: "chunking", label: "Chunking", description: "Dynamic-import boundaries, shared chunks" },
] as const;

interface PipelineStagesProps {
  graph: DependencyGraph | null;
  error: string | null;
}

/**
 * Resolution renders core's real graph output once one exists. The other
 * four stages stay empty placeholders — stage 7 wires those up, no new
 * bundling logic belongs here.
 */
export function PipelineStages({ graph, error }: PipelineStagesProps) {
  return (
    <div className="pipeline-stages">
      <section className="pipeline-stage">
        <h3>Resolution</h3>
        <p>Dependency graph from the entry point</p>
        {error && <p className="pipeline-stage__error">{error}</p>}
        {!error && !graph && (
          <p className="pipeline-stage__placeholder">Confirm an entry point above to resolve.</p>
        )}
        {graph && <ResolutionSummary graph={graph} />}
      </section>

      {LATER_STAGES.map((stage) => (
        <section key={stage.key} className="pipeline-stage pipeline-stage--empty">
          <h3>{stage.label}</h3>
          <p>{stage.description}</p>
          <p className="pipeline-stage__placeholder">Not wired up yet.</p>
        </section>
      ))}
    </div>
  );
}

function ResolutionSummary({ graph }: { graph: DependencyGraph }) {
  const localCount = countNodes(graph, "local");
  const externalCount = countNodes(graph, "external");
  const staticCount = countEdges(graph, "static");
  const dynamicCount = countEdges(graph, "dynamic");

  return (
    <ul className="pipeline-stage__summary">
      <li>
        {graph.nodes.size} nodes — {localCount} local, {externalCount} external
      </li>
      <li>
        {graph.edges.length} edges — {staticCount} static, {dynamicCount} dynamic
      </li>
      <li className="pipeline-stage__node-list">
        {[...graph.nodes.values()].map((node) =>
          node.kind === "local" ? (
            <span key={node.path} className="pipeline-stage__node pipeline-stage__node--local">
              {node.path}
            </span>
          ) : (
            <span
              key={node.specifier}
              className="pipeline-stage__node pipeline-stage__node--external"
            >
              {node.specifier} (external)
            </span>
          ),
        )}
      </li>
    </ul>
  );
}

function countNodes(graph: DependencyGraph, kind: "local" | "external"): number {
  let count = 0;
  for (const node of graph.nodes.values()) if (node.kind === kind) count++;
  return count;
}

function countEdges(graph: DependencyGraph, kind: "static" | "dynamic"): number {
  return graph.edges.filter((e) => e.kind === kind).length;
}
