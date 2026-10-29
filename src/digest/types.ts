// Plan morning-digest § 1. The contract every part of § 2 builds against: one row per job for
// one night of `runs/<night>.jsonl`.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of the run log, after parsing.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

export type DigestRow = {
  job: string;
  // `null` stays `null` here; views show it as `—`.
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  // Times as written in the log, offset kept (styleguide).
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string;
  // Sorted by job.
  rows: DigestRow[];
  // Lines that didn't parse: counted, never thrown.
  badLines: number;
};

// `null` when `runs/<night>.jsonl` doesn't exist (the routes answer 404).
// An empty file gives `{ rows: [], badLines: 0 }`.
export type ReadNight = (runsDir: string, night: string) => Night | null;
