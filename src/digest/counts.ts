import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RunStatus } from './types.js';

export type NightCounts = { ok: number; retry: number; fail: number };

const STATUSES: readonly string[] = ['ok', 'retry', 'fail'];

// Counts run lines per status for runs/<night>.jsonl. Bad lines are skipped, never thrown.
// `null` when the file doesn't exist.
export function countNight(runsDir: string, night: string): NightCounts | null {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const v: unknown = JSON.parse(line);
      if (typeof v !== 'object' || v === null) continue;
      const s = (v as { status?: unknown }).status;
      if (typeof s === 'string' && STATUSES.includes(s)) counts[s as RunStatus]++;
    } catch {
      // bad line: skipped
    }
  }
  return counts;
}
