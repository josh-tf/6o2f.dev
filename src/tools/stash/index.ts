import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { bodyLimit } from 'hono/body-limit';
import { fail, gate, page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';
import { KEY_RE, MAX_BYTES, MAX_KEYS } from './logic.ts';

const app = new Hono<AppEnv>();
app.onError((e, c) => (e instanceof HTTPException ? c.json({ error: e.message }, e.status) : (console.error(e), c.json({ error: 'Internal error' }, 500))));
app.use('*', gate);
app.get('/', (c) => page(c, 'stash'));

app.get('/api/kv', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT key, length(CAST(value AS BLOB)) AS size, updated_at FROM stash_kv WHERE user_id = ? ORDER BY key LIMIT ?')
    .bind(c.get('user').id, MAX_KEYS)
    .all();
  return c.json(results);
});

const key = (c: { req: { param: (n: 'key') => string } }) =>
  KEY_RE.test(c.req.param('key')) ? c.req.param('key') : fail(400, 'Key must match [A-Za-z0-9._:-]{1,100}');

app.get('/api/kv/:key', async (c) => {
  const row = await c.env.DB.prepare('SELECT value FROM stash_kv WHERE user_id = ? AND key = ?').bind(c.get('user').id, key(c)).first<{ value: string }>();
  if (!row) return fail(404, 'Not found');
  return c.body(row.value, 200, { 'content-type': 'text/plain; charset=utf-8', 'content-security-policy': 'sandbox', 'cache-control': 'no-store' });
});

app.put('/api/kv/:key', bodyLimit({ maxSize: MAX_BYTES, onError: (c) => c.json({ error: 'Value too large (max 64KB)' }, 413) }), async (c) => {
  const k = key(c),
    uid = c.get('user').id,
    value = await c.req.text();
  // One statement: insert/update an existing key, or a new key only while the user is under the cap.
  const r = await c.env.DB.prepare(
    `INSERT INTO stash_kv (user_id, key, value, updated_at)
     SELECT ?1, ?2, ?3, ?4 WHERE EXISTS (SELECT 1 FROM stash_kv WHERE user_id = ?1 AND key = ?2) OR (SELECT COUNT(*) FROM stash_kv WHERE user_id = ?1) < ?5
     ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  )
    .bind(uid, k, value, Date.now(), MAX_KEYS)
    .run();
  if (!r.meta.changes) return fail(409, `Limit of ${MAX_KEYS} keys reached`);
  return c.json({ key: k, size: new TextEncoder().encode(value).length });
});

app.delete('/api/kv/:key', async (c) => {
  await c.env.DB.prepare('DELETE FROM stash_kv WHERE user_id = ? AND key = ?').bind(c.get('user').id, key(c)).run();
  return c.body(null, 204);
});

export const tool: Tool = {
  name: 'stash',
  title: 'Stash',
  blurb: 'Key-value store with a curl API',
  icon: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M9 12h6"/>',
  note: 'Needs sign-in (browser or API token). Every key is private to your account.',
  app,
};
