import { Fragment, useState, type ReactNode } from "react";
import type { DependencyGraph } from "openbundle-core";
import { JobCard } from "./pipeline/JobCard.js";
import { Connector } from "./pipeline/Connector.js";
import { formatDuration } from "./pipeline/formatDuration.js";
import type { JobStatus } from "./pipeline/types.js";

interface PipelineStagesProps {
  graph: DependencyGraph | null;
  error: string | null;
  resolveDurationMs: number | null;
}

interface StageConfig {
  key: string;
  columnLabel: string;
  jobName: string;
  status: JobStatus;
  statusLine: string;
}

/**
 * The pipeline shell: five stage columns, one job card each, connected
 * by curved lines, with a single detail panel below the row. This shell
 * is meant to stay fixed as later stages land — only the per-stage
 * status and detail content in `renderDetail` grows.
 */
export function PipelineStages({ graph, error, resolveDurationMs }: PipelineStagesProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const resolveStatus: JobStatus = error ? "failed" : graph ? "passed" : "not-started";
  const resolveStatusLine =
    resolveStatus === "not-started"
      ? "not started"
      : `${formatDuration(resolveDurationMs ?? 0)} · ${resolveStatus}`;

  const stages: StageConfig[] = [
    {
      key: "resolve",
      columnLabel: "RESOLVE",
      jobName: "resolve:graph",
      status: resolveStatus,
      statusLine: resolveStatusLine,
    },
    { key: "order", columnLabel: "ORDER", jobName: "order:sequence", status: "not-started", statusLine: "not started" },
    { key: "merge", columnLabel: "MERGE", jobName: "merge:scope", status: "not-started", statusLine: "not started" },
    { key: "shake", columnLabel: "SHAKE", jobName: "shake:reachability", status: "not-started", statusLine: "not started" },
    { key: "chunk", columnLabel: "CHUNK", jobName: "chunk:output", status: "not-started", statusLine: "not started" },
  ];

  const selectedStage = stages.find((s) => s.key === selectedKey) ?? null;

  function toggleSelected(key: string) {
    setSelectedKey((current) => (current === key ? null : key));
  }

  return (
    <div className="pipeline">
      <div className="pipeline-row">
        {stages.map((stage, i) => (
          <Fragment key={stage.key}>
            <div className="pipeline-column">
              <div className="pipeline-column__header">{stage.columnLabel}</div>
              <JobCard
                jobName={stage.jobName}
                status={stage.status}
                statusLine={stage.statusLine}
                selected={selectedKey === stage.key}
                onClick={() => toggleSelected(stage.key)}
              />
            </div>
            {i < stages.length - 1 && <Connector />}
          </Fragment>
        ))}
      </div>

      {selectedStage && (
        <div className="pipeline-detail">
          <h3 className="pipeline-detail__title">{selectedStage.jobName}</h3>
          {renderDetail(selectedStage.key, selectedStage.status, { graph, error })}
        </div>
      )}
    </div>
  );
}

function renderDetail(
  key: string,
  status: JobStatus,
  ctx: { graph: DependencyGraph | null; error: string | null },
): ReactNode {
  if (key === "resolve") {
    if (status === "passed" && ctx.graph) return <ResolutionSummary graph={ctx.graph} />;
    if (status === "failed") return <p className="pipeline-detail__error">{ctx.error}</p>;
    return <p className="pipeline-detail__empty">Confirm an entry point above to resolve.</p>;
  }

  // order/merge/shake/chunk: no algorithm built yet, so honestly say so —
  // never a placeholder dressed up as output.
  return (
    <p className="pipeline-detail__empty">
      This stage hasn&apos;t run — it isn&apos;t built yet.
    </p>
  );
}

function ResolutionSummary({ graph }: { graph: DependencyGraph }) {
  const localCount = countNodes(graph, "local");
  const externalCount = countNodes(graph, "external");
  const staticCount = countEdges(graph, "static");
  const dynamicCount = countEdges(graph, "dynamic");

  return (
    <div className="resolution-summary">
      <p>
        {graph.nodes.size} nodes — {localCount} local, {externalCount} external
      </p>
      <p>
        {graph.edges.length} edges — {staticCount} static, {dynamicCount} dynamic
      </p>
      <div className="resolution-summary__nodes">
        {[...graph.nodes.values()].map((node) =>
          node.kind === "local" ? (
            <span key={node.path} className="resolution-summary__node resolution-summary__node--local">
              {node.path}
            </span>
          ) : (
            <span
              key={node.specifier}
              className="resolution-summary__node resolution-summary__node--external"
            >
              {node.specifier} (external)
            </span>
          ),
        )}
      </div>
    </div>
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
