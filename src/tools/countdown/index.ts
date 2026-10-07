import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { fail, gate, page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';
import { ID_RE, MAX_EVENTS, newId, validateEvent } from './logic.ts';

// Managing (/ and /api/events*) needs sign-in. Viewing a countdown (/c/<id>, /api/event/<id>) is public by design: ids are random and unlisted.
const app = new Hono<AppEnv>();
app.get('/', gate, (c) => page(c, 'countdown'));
app.use('/api/events', gate);
app.use('/api/events/*', gate);

type Row = { id: string; user_id: string; title: string; target: number; tz: string | null; message: string | null; created_at: number };
const ID = '{[a-z2-9]{8}}';
const pub = (r: Row) => ({ id: r.id, title: r.title, target: r.target, tz: r.tz, message: r.message });

app.get('/api/events', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM countdown_events WHERE user_id = ? ORDER BY target').bind(c.get('user').id).all<Row>();
  return c.json(results.map((r) => ({ ...pub(r), createdAt: r.created_at })));
});
app.post('/api/events', bodyLimit({ maxSize: 4096, onError: (c) => c.json({ error: 'Request body too large' }, 413) }), async (c) => {
  const now = Date.now(),
    uid = c.get('user').id;
  const v = validateEvent(await c.req.json().catch(() => null), now);
  if (typeof v === 'string') return fail(400, v);
  const n = (await c.env.DB.prepare('SELECT COUNT(*) AS n FROM countdown_events WHERE user_id = ?').bind(uid).first<{ n: number }>())?.n ?? 0;
  if (n >= MAX_EVENTS) return fail(409, `Limit of ${MAX_EVENTS} countdowns reached. Delete one first.`);
  const id = newId();
  await c.env.DB.prepare('INSERT INTO countdown_events (id, user_id, title, target, tz, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, uid, v.title, v.target, v.tz, v.message, now)
    .run();
  return c.json({ id, ...v }, 201);
});
app.delete(`/api/events/:id${ID}`, async (c) => {
  const r = await c.env.DB.prepare('DELETE FROM countdown_events WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  return r.meta.changes ? c.body(null, 204) : fail(404, 'Countdown not found');
});

// ---- public viewer ----
app.get(`/c/:id${ID}`, async (c) => {
  const res = await c.env.ASSETS.fetch(new Request(new URL('/_/countdown/view', c.req.url)));
  return new Response(res.body, {
    status: res.status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex', 'cache-control': 'no-store' },
  });
});
app.get(`/api/event/:id${ID}`, async (c) => {
  const id = c.req.param('id');
  if (!ID_RE.test(id)) return fail(404, 'Countdown not found');
  const r = await c.env.DB.prepare('SELECT * FROM countdown_events WHERE id = ?').bind(id).first<Row>();
  return r ? c.json(pub(r), 200, { 'x-robots-tag': 'noindex', 'cache-control': 'public, max-age=30' }) : fail(404, 'Countdown not found');
});

export const tool: Tool = {
  name: 'countdown',
  title: 'Countdown',
  blurb: 'Shareable event countdowns',
  icon: '<path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h5"/><path d="M17.5 17.5 16 16.3V14"/><circle cx="16" cy="16" r="6"/>',
  note: 'Creating countdowns needs sign-in. Anyone with a countdown link can view it, no sign-in needed.',
  app,
};
