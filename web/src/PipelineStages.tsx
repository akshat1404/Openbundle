const STAGES = [
  { key: "resolution", label: "Resolution", description: "Dependency graph from the entry point" },
  { key: "ordering", label: "Ordering", description: "Topological sort" },
  { key: "merge", label: "Merge", description: "Scope-hoisted, collision-renamed single scope" },
  { key: "treeShaking", label: "Tree-shaking", description: "Mark-and-sweep reachability" },
  { key: "chunking", label: "Chunking", description: "Dynamic-import boundaries, shared chunks" },
] as const;

/**
 * Placeholder sections only. Stage 7 wires these to core's real,
 * already-computed output — no logic lives here yet.
 */
export function PipelineStages() {
  return (
    <div className="pipeline-stages">
      {STAGES.map((stage) => (
        <section key={stage.key} className="pipeline-stage pipeline-stage--empty">
          <h3>{stage.label}</h3>
          <p>{stage.description}</p>
          <p className="pipeline-stage__placeholder">Not wired up yet.</p>
        </section>
      ))}
    </div>
  );
}
