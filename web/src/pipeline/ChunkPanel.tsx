import { useState } from "react";
import type { ChunkResult } from "openbundle-core";
import { ChunkGraph } from "./ChunkGraph.js";

/**
 * Chunk cards alone would hide the thing this stage actually decided:
 * which chunk needs which. The graph shows that relationship directly;
 * clicking a chunk shows its real generated code below.
 */
export function ChunkPanel({ result }: { result: ChunkResult }) {
  const [selected, setSelected] = useState<string | null>(
    result.chunks.find((c) => c.chunk.kind === "main")?.chunk.outputFile ?? result.chunks[0]?.chunk.outputFile ?? null,
  );

  const selectedOutput = result.chunks.find((c) => c.chunk.outputFile === selected) ?? null;

  return (
    <div className="chunk-panel">
      <ChunkGraph chunks={result.chunks} edges={result.edges} selected={selected} onSelect={setSelected} />

      {selectedOutput && (
        <div className="chunk-panel__detail">
          <p className="chunk-panel__meta">
            <code>{selectedOutput.chunk.outputFile}</code> — {selectedOutput.chunk.files.join(", ")}
            {selectedOutput.exported.length > 0 && (
              <>
                {" "}
                — exports <code>{selectedOutput.exported.join(", ")}</code>
              </>
            )}
          </p>
          <pre className="merge-panel__code">
            <code>{selectedOutput.code}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
