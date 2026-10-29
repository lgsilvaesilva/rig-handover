import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

let dir: string;
let app: ReturnType<typeof createApp>;

const line = (job: string, status: string, at: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ at, job, status, owner: 'ana', ...extra });

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, '2026-01-01.jsonl'),
    [
      line('zeta', 'ok', '2026-01-01T01:00:00+01:00'),
      line('alpha', 'retry', '2026-01-01T02:00:00+01:00'),
      line('alpha', 'fail', '2026-01-01T02:05:00+01:00', { error: 'boom' }),
      line('mid', 'ok', '2026-01-01T03:00:00+01:00'),
    ].join('\n') + '\n',
  );
  writeFileSync(join(dir, '2026-01-02.jsonl'), '');
  writeFileSync(
    join(dir, '2026-01-03.jsonl'),
    [line('b-job', 'ok', '2026-01-03T01:00:00+01:00'), 'not json {', line('a-job', 'ok', '2026-01-03T02:00:00+01:00')].join('\n') + '\n',
  );
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir });
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const page = (n: string) => app.request(`/digest/${n}`);
const json = (n: string) => app.request(`/api/digest/${n}`);

describe('digest routes', () => {
  it('200 for a night with data', async () => {
    const p = await page('2026-01-01');
    expect(p.status).toBe(200);
    expect(await p.text()).toContain('alpha');
    const j = await json('2026-01-01');
    expect(j.status).toBe(200);
    const body = (await j.json()) as Night;
    expect(body.night).toBe('2026-01-01');
    expect(body.rows).toHaveLength(3);
  });

  it('404 for a night with no file', async () => {
    expect((await page('2026-01-09')).status).toBe(404);
    expect((await json('2026-01-09')).status).toBe(404);
  });

  it('empty night: nothing ran, rows [] and badLines 0', async () => {
    const p = await page('2026-01-02');
    expect(p.status).toBe(200);
    expect(await p.text()).toContain('nothing ran');
    const j = await json('2026-01-02');
    expect(j.status).toBe(200);
    const body = (await j.json()) as Night;
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });

  it('bad line: page still 200 and notes it, JSON badLines 1', async () => {
    const p = await page('2026-01-03');
    expect(p.status).toBe(200);
    const html = await p.text();
    expect(html).toMatch(/1 line didn(&#39;|')t parse/);
    const j = await json('2026-01-03');
    expect(j.status).toBe(200);
    const body = (await j.json()) as Night;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['a-job', 'b-job']);
  });

  it('page and JSON list the same jobs in the same order', async () => {
    const html = await (await page('2026-01-01')).text();
    const body = (await (await json('2026-01-01')).json()) as Night;
    const jobs = body.rows.map((r) => r.job);
    expect(jobs).toEqual(['alpha', 'mid', 'zeta']);
    const inPage = [...html.matchAll(/<tr[^>]*><td>([^<]*)<\/td>/g)].map((m) => m[1]);
    expect(inPage).toEqual(jobs);
  });
});
