import type { JobStatus } from "./types.js";

/**
 * Passed: green filled circle, white check.
 * Failed: red filled circle, white X.
 * Not started: hollow gray ring, no fill.
 * Color itself comes from the surrounding `.job-icon--<status>` class via
 * currentColor, so the icon and the rest of the card's status text stay
 * in sync from one place in CSS.
 */
export function StatusIcon({ status }: { status: JobStatus }) {
  if (status === "passed") {
    return (
      <svg
        className="job-icon job-icon--passed"
        viewBox="0 0 20 20"
        width={20}
        height={20}
        aria-hidden="true"
      >
        <circle cx="10" cy="10" r="9" fill="currentColor" />
        <path
          d="M6 10.3l2.6 2.6L14.2 7"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (status === "failed") {
    return (
      <svg
        className="job-icon job-icon--failed"
        viewBox="0 0 20 20"
        width={20}
        height={20}
        aria-hidden="true"
      >
        <circle cx="10" cy="10" r="9" fill="currentColor" />
        <path
          d="M7 7l6 6M13 7l-6 6"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg
      className="job-icon job-icon--not-started"
      viewBox="0 0 20 20"
      width={20}
      height={20}
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
