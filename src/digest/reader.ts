// Plan morning-digest § 1: read `runs/<night>.jsonl` into one row per job.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, ReadNight, RunLine, RunStatus } from './types.js';

const STATUSES: readonly RunStatus[] = ['ok', 'retry', 'fail'];

const isStatus = (v: unknown): v is RunStatus =>
  typeof v === 'string' && (STATUSES as readonly string[]).includes(v);

// Parse one line at the edge. `null` means a bad line: counted, never thrown.
export const parseLine = (text: string): RunLine | null => {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.at !== 'string' || o.at === '') return null;
  if (typeof o.job !== 'string' || o.job === '') return null;
  if (!isStatus(o.status)) return null;
  // A missing owner reads as `null`; any other non-string owner is a bad line.
  const owner = o.owner === undefined || o.owner === null ? null : o.owner;
  if (owner !== null && typeof owner !== 'string') return null;
  if (o.error !== undefined && typeof o.error !== 'string') return null;
  const line: RunLine = { at: o.at, job: o.job, status: o.status, owner };
  if (typeof o.error === 'string') line.error = o.error;
  return line;
};

const readText = (path: string): string | null => {
  try {
    return readFileSync(path, 'utf8');
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') return null;
    throw err;
  }
};

export const readNight: ReadNight = (runsDir, night) => {
  const text = readText(join(runsDir, `${night}.jsonl`));
  if (text === null) return null;

  const byJob = new Map<string, DigestRow>();
  let badLines = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    if (rawLine.trim() === '') continue;
    const line = parseLine(rawLine);
    if (line === null) {
      badLines += 1;
      continue;
    }
    const retry = line.status === 'retry' ? 1 : 0;
    const prev = byJob.get(line.job);
    // Lines are appended in time order, so the later line in the file is the latest.
    byJob.set(line.job, {
      job: line.job,
      owner: line.owner,
      runs: (prev?.runs ?? 0) + 1,
      retries: (prev?.retries ?? 0) + retry,
      lastStatus: line.status,
      lastError: line.error ?? null,
      firstAt: prev?.firstAt ?? line.at,
      lastAt: line.at,
    });
  }

  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows, badLines };
};
