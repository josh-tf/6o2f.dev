import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { bodyLimit } from 'hono/body-limit';
import { fail, gate, page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';
import { MAX_BYTES, newId, ttlSeconds } from './logic.ts';

// KV layout: p:<id> = text, u:<userId>:<id> = '' + metadata {created, expires, size, preview} (the per-user index). Both expire together.
const app = new Hono<AppEnv>();
// A tool app is fetched directly (not via root), so root's onError doesn't apply: answer errors as JSON here.
app.onError((e, c) => (e instanceof HTTPException ? c.json({ error: e.message }, e.status) : (console.error(e), c.json({ error: 'Internal error' }, 500))));
const id = '/:id{[A-Za-z0-9_-]{8,64}}';

app.get('/', gate, (c) => (c.req.header('accept')?.includes('text/html') ? page(c, 'paste') : fail(400, 'POST text to this URL to create a paste')));

app.post('/', gate, bodyLimit({ maxSize: MAX_BYTES, onError: (c) => c.json({ error: 'Paste too large (max 512KB)' }, 413) }), async (c) => {
  const ttl = ttlSeconds(c.req.query('ttl'));
  if (!ttl) return fail(400, 'ttl must be 1h, 1d, 7d or 30d');
  const text = await c.req.text();
  if (!text.trim()) return fail(400, 'Empty paste');
  const pid = newId();
  const now = Date.now();
  await Promise.all([
    c.env.PASTE.put(`p:${pid}`, text, { expirationTtl: ttl }),
    c.env.PASTE.put(`u:${c.get('user').id}:${pid}`, '', {
      expirationTtl: ttl,
      metadata: { created: now, expires: now + ttl * 1000, size: new TextEncoder().encode(text).length, preview: text.slice(0, 80) },
    }),
  ]);
  const host = (c.env.DEV && c.req.header('x-host')) || new URL(c.req.url).host;
  return c.text(`https://${host}/${pid}\n`, 201);
});

app.get('/api/pastes', gate, async (c) => {
  const { keys } = await c.env.PASTE.list<{ created: number; expires: number; size: number; preview: string }>({ prefix: `u:${c.get('user').id}:` }); // ponytail: first 1000 only, paginate if anyone needs more
  return c.json(keys.map((k) => ({ id: k.name.split(':')[2], ...k.metadata })).sort((a, b) => (b.created ?? 0) - (a.created ?? 0)));
});

// Public raw read. Never HTML: text/plain + nosniff (global) + CSP sandbox.
app.get(id, async (c) => {
  const text = await c.env.PASTE.get(`p:${c.req.param('id')}`);
  if (text === null) return c.text('Not found\n', 404);
  return c.body(text, 200, { 'content-type': 'text/plain; charset=utf-8', 'content-security-policy': 'sandbox', 'cache-control': 'no-store' });
});

app.delete(id, gate, async (c) => {
  const pid = c.req.param('id');
  const mine = `u:${c.get('user').id}:${pid}`;
  if ((await c.env.PASTE.get(mine)) === null) return fail(404, 'Not found'); // not yours looks the same as gone
  await Promise.all([c.env.PASTE.delete(`p:${pid}`), c.env.PASTE.delete(mine)]);
  return c.body(null, 204);
});

export const tool: Tool = {
  name: 'paste',
  title: 'Paste',
  blurb: 'Share text with an expiry',
  icon: '<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/>',
  note: 'Reading a paste is public by link. Creating needs sign-in.',
  app,
};
