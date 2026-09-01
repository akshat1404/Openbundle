import type { DependencyGraph, GraphNode } from "openbundle-core";

/**
 * The actual dependency graph as a node-and-edge diagram — not a count.
 * Nodes are laid out by BFS depth from the entry point (same approach as
 * the earlier illustrator prototype); edges are drawn straight from the
 * real graph data the resolve stage computed, static as solid lines,
 * dynamic as dashed.
 */
export function GraphDiagram({ graph }: { graph: DependencyGraph }) {
  const layout = layoutGraph(graph);
  if (layout.nodes.length === 0) return null;

  return (
    <div className="graph-diagram">
      <svg
        className="graph-diagram__svg"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        width={layout.width}
        height={layout.height}
        role="img"
        aria-label="Dependency graph, laid out by depth from the entry point"
      >
        <defs>
          <marker
            id="graph-diagram-arrow"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L8,4 L0,8 Z" className="graph-diagram__arrowhead" />
          </marker>
        </defs>

        {layout.edges.map((edge, i) => (
          <path
            key={i}
            d={edge.path}
            className={`graph-diagram__edge graph-diagram__edge--${edge.kind}`}
            markerEnd="url(#graph-diagram-arrow)"
          />
        ))}

        {layout.nodes.map((n) => (
          <g
            key={n.id}
            transform={`translate(${n.x}, ${n.y})`}
            className={
              "graph-diagram__node" +
              (n.node.kind === "external" ? " graph-diagram__node--external" : "") +
              (n.id === graph.entry ? " graph-diagram__node--entry" : "")
            }
          >
            <title>{n.label}</title>
            <rect width={n.width} height={n.height} rx={7} />
            <text x={n.width / 2} y={n.height / 2} dominantBaseline="middle" textAnchor="middle">
              {n.label}
            </text>
            {n.id === graph.entry && (
              <text x={n.width / 2} y={-6} textAnchor="middle" className="graph-diagram__entry-tag">
                ENTRY
              </text>
            )}
          </g>
        ))}
      </svg>

      <div className="graph-diagram__legend">
        <span>
          <i className="graph-diagram__legend-line graph-diagram__legend-line--static" /> static
          import
        </span>
        <span>
          <i className="graph-diagram__legend-line graph-diagram__legend-line--dynamic" /> dynamic
          import
        </span>
        <span>
          <i className="graph-diagram__legend-swatch" /> external (never opened)
        </span>
      </div>
    </div>
  );
}

interface LayoutNode {
  id: string;
  node: GraphNode;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LayoutEdge {
  kind: "static" | "dynamic";
  path: string;
}

interface GraphLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
}

const LAYER_GAP = 170;
const ROW_GAP = 40;
const NODE_HEIGHT = 34;
const PADDING = 28;
const CHAR_WIDTH = 6.2;
const MIN_NODE_WIDTH = 90;
const MAX_NODE_WIDTH = 190;

function layoutGraph(graph: DependencyGraph): GraphLayout {
  if (graph.nodes.size === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  // BFS depth from the entry point, walking the real edges — the same
  // layering the earlier prototype used.
  const adjacency = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from)!.push(edge.to);
  }

  const layerOf = new Map<string, number>([[graph.entry, 0]]);
  const queue: string[] = [graph.entry];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const depth = layerOf.get(current)!;
    for (const next of adjacency.get(current) ?? []) {
      if (!layerOf.has(next)) {
        layerOf.set(next, depth + 1);
        queue.push(next);
      }
    }
  }

  const layers = new Map<number, string[]>();
  for (const id of graph.nodes.keys()) {
    const layer = layerOf.get(id) ?? 0;
    if (!layers.has(layer)) layers.set(layer, []);
    layers.get(layer)!.push(id);
  }

  const maxLayer = Math.max(...layers.keys());
  const maxRows = Math.max(...[...layers.values()].map((ids) => ids.length));
  const columnHeight = maxRows * (NODE_HEIGHT + ROW_GAP) - ROW_GAP;

  const nodeById = new Map<string, LayoutNode>();
  for (let layer = 0; layer <= maxLayer; layer++) {
    const ids = layers.get(layer) ?? [];
    const columnContentHeight = ids.length * (NODE_HEIGHT + ROW_GAP) - ROW_GAP;
    const startY = PADDING + (columnHeight - columnContentHeight) / 2;

    ids.forEach((id, row) => {
      const node = graph.nodes.get(id)!;
      const label = node.kind === "external" ? node.specifier : node.path;
      const width = clamp(label.length * CHAR_WIDTH + 24, MIN_NODE_WIDTH, MAX_NODE_WIDTH);
      nodeById.set(id, {
        id,
        node,
        label,
        x: PADDING + layer * LAYER_GAP,
        y: startY + row * (NODE_HEIGHT + ROW_GAP),
        width,
        height: NODE_HEIGHT,
      });
    });
  }

  const edges: LayoutEdge[] = graph.edges.map((e) => {
    const from = nodeById.get(e.from)!;
    const to = nodeById.get(e.to)!;
    const x1 = from.x + from.width;
    const y1 = from.y + from.height / 2;
    const x2 = to.x;
    const y2 = to.y + to.height / 2;
    const midX = (x1 + x2) / 2;
    return { kind: e.kind, path: `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}` };
  });

  return {
    nodes: [...nodeById.values()],
    edges,
    width: PADDING + maxLayer * LAYER_GAP + MAX_NODE_WIDTH + PADDING,
    height: columnHeight + PADDING * 2 + 14, // + room for the ENTRY tag above the top row
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}
