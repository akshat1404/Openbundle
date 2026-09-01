import type { ShakeItem, ShakeReason } from "openbundle-core";

const REASON_LABEL: Record<ShakeReason, string> = {
  "reachable-from-entry": "reachable from entry",
  unreferenced: "never referenced",
  "side-effect-free": "no observable effect",
  "possible-side-effect": "may have a real effect",
  "external-import": "external — never opened",
};

interface ShakePanelProps {
  code: string;
  kept: ShakeItem[];
  removed: ShakeItem[];
}

/**
 * Kept-versus-removed is the obvious shape, but "kept" and "removed"
 * alone hide the actual decision — every item carries the real reason
 * mark-and-sweep landed on it, not just the verdict.
 */
export function ShakePanel({ code, kept, removed }: ShakePanelProps) {
  return (
    <div className="shake-panel">
      <div className="shake-panel__columns">
        <div className="shake-panel__column">
          <h4>Kept ({kept.length})</h4>
          <ul>
            {kept.map((item, i) => (
              <li key={`${item.file}:${item.label}:${i}`} className="shake-panel__item shake-panel__item--kept">
                <code>{item.label}</code>
                <span className="shake-panel__reason">{REASON_LABEL[item.reason]}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="shake-panel__column">
          <h4>Removed ({removed.length})</h4>
          <ul>
            {removed.map((item, i) => (
              <li
                key={`${item.file}:${item.label}:${i}`}
                className="shake-panel__item shake-panel__item--removed"
              >
                <code>{item.label}</code>
                <span className="shake-panel__reason">{REASON_LABEL[item.reason]}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <pre className="merge-panel__code">
        <code>{code}</code>
      </pre>
    </div>
  );
}
