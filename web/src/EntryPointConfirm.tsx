import { useState } from "react";
import type { SampleFile } from "./sampleProject.js";
import { detectEntryPoint } from "./entryPoint.js";

interface EntryPointConfirmProps {
  files: SampleFile[];
  onConfirm: (entryPath: string) => void;
}

/**
 * Surfaces the auto-detected entry point and requires explicit
 * confirmation (or an override) before resolution runs. Resolution
 * never runs silently against a guessed entry point.
 *
 * The parent remounts this (via a changing `key`) whenever the project
 * itself changes, so detection/selection state never goes stale.
 */
export function EntryPointConfirm({ files, onConfirm }: EntryPointConfirmProps) {
  const detected = detectEntryPoint(files);
  const [selected, setSelected] = useState<string>(detected ?? files[0]?.path ?? "");
  const [confirmedPath, setConfirmedPath] = useState<string | null>(null);

  function handleConfirm() {
    setConfirmedPath(selected);
    onConfirm(selected);
  }

  return (
    <div className="entry-point-confirm">
      <p>
        {detected ? (
          <>
            Detected entry point: <code>{detected}</code>
          </>
        ) : (
          "No entry point could be auto-detected — pick one below."
        )}
      </p>
      <label className="entry-point-confirm__field">
        Entry point:{" "}
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {files.map((f) => (
            <option key={f.path} value={f.path}>
              {f.path}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={handleConfirm} disabled={!selected}>
        Confirm entry point
      </button>
      {confirmedPath === selected && confirmedPath && (
        <p className="entry-point-confirm__status">
          Resolving from <code>{confirmedPath}</code>
        </p>
      )}
    </div>
  );
}
