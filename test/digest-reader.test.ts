import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

const tmp = mkdtempSync(join(tmpdir(), 'rig-reader-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('gives 5 jobs, sorted, and 1 bad line', () => {
    expect(night).not.toBeNull();
    expect(night?.badLines).toBe(1);
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('counts runs and retries for fixtures/refresh', () => {
    const row = night?.rows.find((r) => r.job === 'fixtures/refresh');
    expect(row).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('keeps the digest/render row with a null owner', () => {
    const row = night?.rows.find((r) => r.job === 'digest/render');
    expect(row?.owner).toBeNull();
    expect(row?.runs).toBe(1);
  });

  it('keeps the last error of a failing job', () => {
    const row = night?.rows.find((r) => r.job === 'notes/backup');
    expect(row?.lastStatus).toBe('fail');
    expect(row?.lastError).toBe('quota exceeded');
  });
});

describe('readNight edge cases', () => {
  it('returns null for a missing file', () => {
    expect(readNight(tmp, '1999-01-01')).toBeNull();
  });

  it('gives no rows and no bad lines for an empty file', () => {
    writeFileSync(join(tmp, '2026-01-01.jsonl'), '');
    expect(readNight(tmp, '2026-01-01')).toEqual({ night: '2026-01-01', rows: [], badLines: 0 });
  });

  it('counts invalid lines and skips blank ones', () => {
    const lines = [
      '{"at":"2026-01-02T01:00:00+01:00","job":"a","status":"ok","owner":"x"}',
      '{"at":"2026-01-02T01:00:00+01:00","status":"ok","owner":"x"}',
      '{"job":"a","status":"ok","owner":"x"}',
      '{"at":"2026-01-02T01:00:00+01:00","job":"a","status":"done","owner":"x"}',
      'not json',
      '',
      '',
    ];
    writeFileSync(join(tmp, '2026-01-02.jsonl'), lines.join('\n'));
    const night = readNight(tmp, '2026-01-02');
    expect(night?.badLines).toBe(4);
    expect(night?.rows).toHaveLength(1);
  });
});
