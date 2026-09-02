import type { ChunkEdge, ChunkOutput } from "openbundle-core";

interface ChunkGraphProps {
  chunks: ChunkOutput[];
  edges: ChunkEdge[];
  selected: string | null;
  onSelect: (outputFile: string) => void;
}

/**
 * The chunk relationships matter as much as the chunks themselves here —
 * a row of four boxes would hide exactly the thing this stage exists to
 * show. Same layered-by-depth approach as the resolve stage's own graph:
 * main first, everything it reaches further out, solid lines for static
 * cross-chunk imports, dashed for the dynamic-import boundary that
 * created a chunk in the first place.
 */
export function ChunkGraph({ chunks, edges, selected, onSelect }: ChunkGraphProps) {
  const layout = layoutChunks(chunks, edges);
  if (layout.nodes.length === 0) return null;

  return (
    <div className="chunk-graph">
      <svg
        className="chunk-graph__svg"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        width={layout.width}
        height={layout.height}
        role="img"
        aria-label="Chunk dependency graph"
      >
        <defs>
          <marker
            id="chunk-graph-arrow"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L8,4 L0,8 Z" className="chunk-graph__arrowhead" />
          </marker>
        </defs>

        {layout.edges.map((edge, i) => (
          <path
            key={i}
            d={edge.path}
            className={`chunk-graph__edge chunk-graph__edge--${edge.kind}`}
            markerEnd="url(#chunk-graph-arrow)"
          />
        ))}

        {layout.nodes.map((n) => (
          <g
            key={n.outputFile}
            transform={`translate(${n.x}, ${n.y})`}
            className={
              "chunk-graph__node" +
              ` chunk-graph__node--${n.kind}` +
              (n.outputFile === selected ? " chunk-graph__node--selected" : "")
            }
            onClick={() => onSelect(n.outputFile)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(n.outputFile)}
          >
            <title>{n.outputFile}</title>
            <rect width={n.width} height={n.height} rx={7} />
            <text x={n.width / 2} y={16} textAnchor="middle" className="chunk-graph__filename">
              {n.outputFile}
            </text>
            <text x={n.width / 2} y={30} textAnchor="middle" className="chunk-graph__kind">
              {n.kind}
            </text>
          </g>
        ))}
      </svg>

      <div className="chunk-graph__legend">
        <span>
          <i className="chunk-graph__legend-line chunk-graph__legend-line--static" /> static
          cross-chunk import
        </span>
        <span>
          <i className="chunk-graph__legend-line chunk-graph__legend-line--dynamic" /> dynamic
          import() boundary
        </span>
      </div>
    </div>
  );
}

interface LayoutNode {
  outputFile: string;
  kind: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LayoutEdge {
  kind: "static" | "dynamic";
  path: string;
}

const LAYER_GAP = 190;
const ROW_GAP = 44;
const NODE_HEIGHT = 40;
const PADDING = 28;
const CHAR_WIDTH = 6.4;
const MIN_NODE_WIDTH = 120;
const MAX_NODE_WIDTH = 210;

function layoutChunks(
  chunks: ChunkOutput[],
  edges: ChunkEdge[],
): { nodes: LayoutNode[]; edges: LayoutEdge[]; width: number; height: number } {
  if (chunks.length === 0) return { nodes: [], edges: [], width: 0, height: 0 };

  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    if (!adjacency.has(e.from)) adjacency.set(e.from, []);
    adjacency.get(e.from)!.push(e.to);
  }

  const mainFile =
    chunks.find((c) => c.chunk.kind === "main")?.chunk.outputFile ?? chunks[0].chunk.outputFile;

  const layerOf = new Map<string, number>([[mainFile, 0]]);
  const queue = [mainFile];
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
  for (const c of chunks) {
    const layer = layerOf.get(c.chunk.outputFile) ?? 0;
    if (!layers.has(layer)) layers.set(layer, []);
    layers.get(layer)!.push(c.chunk.outputFile);
  }

  const maxLayer = Math.max(...layers.keys());
  const maxRows = Math.max(...[...layers.values()].map((ids) => ids.length));
  const columnHeight = maxRows * (NODE_HEIGHT + ROW_GAP) - ROW_GAP;

  const nodeByFile = new Map<string, LayoutNode>();
  for (let layer = 0; layer <= maxLayer; layer++) {
    const ids = layers.get(layer) ?? [];
    const columnContentHeight = ids.length * (NODE_HEIGHT + ROW_GAP) - ROW_GAP;
    const startY = PADDING + (columnHeight - columnContentHeight) / 2;

    ids.forEach((outputFile, row) => {
      const chunk = chunks.find((c) => c.chunk.outputFile === outputFile)!;
      const width = clamp(outputFile.length * CHAR_WIDTH + 24, MIN_NODE_WIDTH, MAX_NODE_WIDTH);
      nodeByFile.set(outputFile, {
        outputFile,
        kind: chunk.chunk.kind,
        x: PADDING + layer * LAYER_GAP,
        y: startY + row * (NODE_HEIGHT + ROW_GAP),
        width,
        height: NODE_HEIGHT,
      });
    });
  }

  const layoutEdges: LayoutEdge[] = edges.map((e) => {
    const from = nodeByFile.get(e.from);
    const to = nodeByFile.get(e.to);
    if (!from || !to) return { kind: e.kind, path: "" };
    const x1 = from.x + from.width;
    const y1 = from.y + from.height / 2;
    const x2 = to.x;
    const y2 = to.y + to.height / 2;
    const midX = (x1 + x2) / 2;
    return { kind: e.kind, path: `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}` };
  });

  return {
    nodes: [...nodeByFile.values()],
    edges: layoutEdges,
    width: PADDING + maxLayer * LAYER_GAP + MAX_NODE_WIDTH + PADDING,
    height: columnHeight + PADDING * 2,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}
