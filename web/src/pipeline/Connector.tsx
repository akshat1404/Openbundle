/**
 * Soft curved connector between two adjacent job cards, matching the
 * reference's bezier style — not a straight line, not an arrow. The
 * spacer above the line mirrors the column header's own box model so
 * the curve lines up with the cards' vertical center regardless of
 * header font-size tweaks.
 */
export function Connector() {
  return (
    <div className="pipeline-connector">
      <div className="pipeline-connector__spacer" aria-hidden="true">
        &nbsp;
      </div>
      <div className="pipeline-connector__line">
        <svg
          className="pipeline-connector__svg"
          viewBox="0 0 60 32"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0,16 C20,4 40,28 60,16" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
    </div>
  );
}
