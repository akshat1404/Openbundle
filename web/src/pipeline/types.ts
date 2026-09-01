/**
 * A job card's real, current state. "failed" is implemented now even
 * though only the resolve stage can produce it today — later stages
 * (merge collisions, chunk generation, ...) reuse the same visual state
 * once they can fail too.
 */
export type JobStatus = "passed" | "failed" | "not-started";
