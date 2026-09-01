import type { MergeCollision } from "openbundle-core";

interface MergePanelProps {
  code: string;
  collisions: MergeCollision[];
}

/**
 * Merge's output is genuinely two things worth seeing: which top-level
 * collisions were actually found and how they were resolved (a plain
 * code block alone would hide that), and the real merged code itself.
 */
export function MergePanel({ code, collisions }: MergePanelProps) {
  return (
    <div className="merge-panel">
      <div className="merge-panel__collisions">
        {collisions.length === 0 ? (
          <p className="merge-panel__no-collisions">
            No naming collisions — every top-level name was already unique.
          </p>
        ) : (
          <>
            <p className="merge-panel__collisions-title">
              {collisions.length} naming collision{collisions.length > 1 ? "s" : ""} resolved:
            </p>
            <ul className="merge-panel__collisions-list">
              {collisions.map((c) => (
                <li key={`${c.file}:${c.name}`}>
                  <code>{c.name}</code> in <code>{c.file}</code> renamed to <code>{c.renamedTo}</code>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <pre className="merge-panel__code">
        <code>{code}</code>
      </pre>
    </div>
  );
}
