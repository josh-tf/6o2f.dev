import { Hono, type Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { bodyLimit } from 'hono/body-limit';
import { adminOnly, fail, gate, page, type AppEnv } from '../../auth.ts';
import { checkUrl, safeFetch } from '../../net.ts';
import type { Tool } from '../types.ts';

const MAX_MONITORS = 20,
  KEEP_MS = 7 * 864e5;
const app = new Hono<AppEnv>();
app.onError((e, c) => (e instanceof HTTPException ? c.json({ error: e.message }, e.status) : (console.error(e), c.json({ error: 'Internal error' }, 500))));
app.get('/', gate, (c) => page(c, 'uptime'));

app.get('/api/monitors', gate, async (c) => {
  const uid = c.get('user').id,
    since = Date.now() - 864e5;
  /* eslint-disable @typescript-eslint/no-explicit-any -- three D1 result sets with different row shapes, joined below */
  const [mons, agg, recent] = await c.env.DB.batch<any>([
    c.env.DB.prepare('SELECT id, name, url, created_at, last_status, last_ms, last_checked FROM uptime_monitors WHERE user_id = ? ORDER BY created_at').bind(
      uid,
    ),
    c.env.DB.prepare(
      'SELECT monitor_id, COUNT(*) n, SUM(status BETWEEN 200 AND 399) up FROM uptime_checks WHERE ts > ? AND monitor_id IN (SELECT id FROM uptime_monitors WHERE user_id = ?) GROUP BY monitor_id',
    ).bind(since, uid),
    c.env.DB.prepare(
      `SELECT monitor_id, status, ms FROM (SELECT monitor_id, status, ms, ts, ROW_NUMBER() OVER (PARTITION BY monitor_id ORDER BY ts DESC) rn FROM uptime_checks WHERE monitor_id IN (SELECT id FROM uptime_monitors WHERE user_id = ?)) WHERE rn <= 48 ORDER BY ts`,
    ).bind(uid),
  ]);
  return c.json(
    mons.results.map((m: any) => {
      const a = agg.results.find((x: any) => x.monitor_id === m.id);
      return {
        ...m,
        up24: a ? Math.round((1000 * a.up) / a.n) / 10 : null,
        recent: recent.results.filter((r: any) => r.monitor_id === m.id).map((r: any) => [r.status, r.ms]),
      };
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }),
  );
});

app.post('/api/monitors', gate, bodyLimit({ maxSize: 4096, onError: (c) => c.json({ error: 'Request too large' }, 413) }), async (c) => {
  const b = await c.req.json<{ name?: string; url?: string }>().catch(() => fail(400, 'Invalid JSON'));
  const url = checkUrl(String(b.url ?? '')).toString();
  const name =
    String(b.name ?? '')
      .trim()
      .slice(0, 60) || new URL(url).hostname;
  const uid = c.get('user').id;
  const n = (await c.env.DB.prepare('SELECT COUNT(*) n FROM uptime_monitors WHERE user_id = ?').bind(uid).first<{ n: number }>())!.n;
  if (n >= MAX_MONITORS) fail(409, `Limit of ${MAX_MONITORS} monitors reached`);
  const id = crypto.randomUUID();
  await c.env.DB.prepare('INSERT INTO uptime_monitors (id, user_id, name, url, created_at) VALUES (?, ?, ?, ?, ?)').bind(id, uid, name, url, Date.now()).run();
  return c.json({ id, name, url }, 201);
});

const mine = (c: Context<AppEnv>) =>
  c.env.DB.prepare('SELECT id FROM uptime_monitors WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).first();

app.delete('/api/monitors/:id', gate, async (c) => {
  if (!(await mine(c))) fail(404, 'Not found');
  const id = c.req.param('id');
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM uptime_checks WHERE monitor_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM uptime_monitors WHERE id = ?').bind(id),
  ]);
  return c.body(null, 204);
});

app.get('/api/monitors/:id/checks', gate, async (c) => {
  if (!(await mine(c))) fail(404, 'Not found');
  const { results } = await c.env.DB.prepare('SELECT ts, status, ms FROM uptime_checks WHERE monitor_id = ? ORDER BY ts DESC LIMIT 100')
    .bind(c.req.param('id'))
    .all();
  return c.json(results);
});

// Dev/admin: run the cron job now.
app.post('/api/run', gate, adminOnly, async (c) => c.json(await runUptime(c.env)));

/** One check: HEAD, retried as GET when the server refuses HEAD. status 0 = no response (blocked URL, DNS, timeout). */
async function check(url: string): Promise<{ status: number; ms: number }> {
  const t0 = Date.now();
  try {
    let r = await safeFetch(url, { method: 'HEAD' });
    if (r.res.status === 405 || r.res.status === 501) r = await safeFetch(url, { method: 'GET', maxBytes: 1024 });
    return { status: r.res.status, ms: r.ms };
  } catch {
    return { status: 0, ms: Date.now() - t0 };
  }
}

/** Runs every 5 minutes from the cron trigger (wired in src/index.ts). */
export const runUptime = async (env: Env) => {
  const { results } = await env.DB.prepare('SELECT m.id, m.url FROM uptime_monitors m JOIN users u ON u.id = m.user_id').all<{ id: string; url: string }>();
  const queue = [...results];
  const worker = async () => {
    for (let m; (m = queue.shift());) {
      const { status, ms } = await check(m.url),
        ts = Date.now();
      await env.DB.batch([
        env.DB.prepare('INSERT INTO uptime_checks (monitor_id, ts, status, ms) VALUES (?, ?, ?, ?)').bind(m.id, ts, status, ms),
        env.DB.prepare('UPDATE uptime_monitors SET last_status = ?, last_ms = ?, last_checked = ? WHERE id = ?').bind(status, ms, ts, m.id),
      ]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(10, results.length) }, worker)); // ponytail: 10 at a time, 50 subrequests/invocation caps the free plan near 25 monitors
  await env.DB.prepare('DELETE FROM uptime_checks WHERE ts < ?')
    .bind(Date.now() - KEEP_MS)
    .run();
  return { checked: results.length };
};

export const tool: Tool = {
  name: 'uptime',
  title: 'Uptime',
  blurb: 'Check sites every 5 min',
  icon: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  note: 'Needs sign-in. Up to 20 monitors each; checks run from our servers every 5 minutes and keep 7 days.',
  app,
};
