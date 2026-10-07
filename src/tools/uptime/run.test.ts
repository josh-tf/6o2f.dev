import test from 'node:test';
import assert from 'node:assert/strict';
import { runUptime } from './index.ts';

// Minimal fake D1: records statements, serves the monitor list.
const log: { sql: string; args: unknown[] }[] = [];
const stmt = (sql: string) => ({
  sql,
  args: [] as unknown[],
  bind(...a: unknown[]) {
    this.args = a;
    return this;
  },
  async all() {
    return {
      results: [
        { id: 'm1', url: 'https://up.example.com/' },
        { id: 'm2', url: 'https://nohead.example.com/' },
        { id: 'm3', url: 'https://down.example.com/' },
        { id: 'm4', url: 'http://127.0.0.1/' },
      ],
    };
  },
  async run() {
    log.push({ sql, args: this.args });
    return {};
  },
});
const env = { DB: { prepare: stmt, batch: async (ss: any[]) => ss.forEach((s) => log.push({ sql: s.sql, args: s.args })) } } as any;

test('runUptime checks, falls back to GET, records failures, prunes', async () => {
  const seen: string[] = [];
  globalThis.fetch = (async (u: URL, init: RequestInit) => {
    const k = `${init.method} ${u.hostname}`;
    seen.push(k);
    if (u.hostname === 'down.example.com') throw new Error('refused');
    if (k === 'HEAD nohead.example.com') return new Response(null, { status: 405 });
    return new Response(init.method === 'HEAD' ? null : 'ok', { status: 200 });
  }) as any;
  const r = await runUptime(env);
  assert.equal(r.checked, 4);
  assert.ok(seen.includes('GET nohead.example.com'));
  const status = (id: string) => log.find((l) => l.sql.startsWith('INSERT') && l.args[0] === id)!.args[2];
  assert.deepEqual([status('m1'), status('m2'), status('m3'), status('m4')], [200, 200, 0, 0]);
  assert.equal(log.filter((l) => l.sql.startsWith('UPDATE')).length, 4);
  assert.ok(log.at(-1)!.sql.startsWith('DELETE FROM uptime_checks WHERE ts <'));
  assert.ok(!seen.some((s) => s.includes('127.0.0.1')));
});
