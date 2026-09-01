import type { JobStatus } from "./types.js";
import { StatusIcon } from "./StatusIcon.js";

export interface JobCardProps {
  jobName: string;
  status: JobStatus;
  statusLine: string;
  selected: boolean;
  onClick: () => void;
}

/**
 * One job card: status icon, bold job name, status line beneath.
 * The pipeline is strictly sequential, so each stage column holds
 * exactly one of these — no parallel-job layout.
 */
export function JobCard({ jobName, status, statusLine, selected, onClick }: JobCardProps) {
  return (
    <button
      type="button"
      className={`job-card job-card--${status}${selected ? " job-card--selected" : ""}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <StatusIcon status={status} />
      <span className="job-card__text">
        <span className="job-card__name">{jobName}</span>
        <span className="job-card__status-line">{statusLine}</span>
      </span>
    </button>
  );
}
