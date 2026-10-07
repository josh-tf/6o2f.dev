import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { fail, gate, page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';
import { cleanName, disposition, MAX_BYTES, newId, ttlMs } from './logic.ts';

type Row = { id: string; user_id: string; name: string; size: number; r2_key: string; created_at: number; expires_at: number; downloads: number };
const app = new Hono<AppEnv>();
app.onError((e, c) => (e instanceof HTTPException ? c.json({ error: e.message }, e.status) : (console.error(e), c.json({ error: 'Internal error' }, 500))));
const link = (url: string, r: { id: string; name: string }) => `${new URL(url).origin}/d/${r.id}/${encodeURIComponent(r.name)}`;
const drop = (env: Env, r: { id: string; r2_key: string }) =>
  Promise.all([env.DROP.delete(r.r2_key), env.DB.prepare('DELETE FROM drop_files WHERE id = ?').bind(r.id).run()]);

// Public: anyone with the link. Always an attachment of opaque bytes (the session cookie is shared across *.6o2f.dev).
app.on(['GET', 'HEAD'], '/d/:id/*', async (c) => {
  const r = await c.env.DB.prepare('SELECT * FROM drop_files WHERE id = ?').bind(c.req.param('id')).first<Row>();
  if (!r) return c.json({ error: 'Not found' }, 404);
  if (r.expires_at <= Date.now()) {
    c.executionCtx.waitUntil(drop(c.env, r));
    return c.json({ error: 'Expired' }, 410);
  }
  const head = c.req.method === 'HEAD';
  const obj = head ? await c.env.DROP.head(r.r2_key) : await c.env.DROP.get(r.r2_key);
  if (!obj) return c.json({ error: 'Not found' }, 404);
  if (!head) c.executionCtx.waitUntil(c.env.DB.prepare('UPDATE drop_files SET downloads = downloads + 1 WHERE id = ?').bind(r.id).run());
  return new Response(head ? null : (obj as R2ObjectBody).body, {
    headers: {
      'content-type': 'application/octet-stream',
      'content-disposition': disposition(r.name),
      'content-length': String(r.size),
      'cache-control': 'private, no-store',
    },
  });
});

app.get('/', gate, (c) => page(c, 'drop'));
app.use('/api/*', gate);

app.put('/api/files', async (c) => {
  const len = c.req.header('content-length');
  if (!len || !/^\d+$/.test(len)) return c.json({ error: 'Content-Length required' }, 411);
  const size = Number(len);
  if (size > MAX_BYTES) fail(413, 'Max 100MB');
  const ttl = ttlMs(c.req.query('ttl'));
  if (!ttl || !c.req.raw.body) fail(400, 'ttl must be 1h, 1d, 7d or 30d, and a body is required');
  const id = newId(),
    name = cleanName(c.req.query('name')),
    type = c.req.header('content-type') ?? null;
  const now = Date.now(),
    expiresAt = now + ttl!;
  await c.env.DROP.put(id, c.req.raw.body, { httpMetadata: { contentType: type ?? undefined } });
  try {
    await c.env.DB.prepare('INSERT INTO drop_files (id, user_id, name, size, type, r2_key, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, c.get('user').id, name, size, type, id, now, expiresAt)
      .run();
  } catch (e) {
    await c.env.DROP.delete(id);
    throw e;
  } // the sweep finds objects only through rows
  return c.json({ id, name, size, expiresAt, url: link(c.req.url, { id, name }) }, 201);
});

app.get('/api/files', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, name, size, created_at, expires_at, downloads FROM drop_files WHERE user_id = ? AND expires_at > ? ORDER BY created_at DESC',
  )
    .bind(c.get('user').id, Date.now())
    .all<Row>();
  return c.json(results.map((r) => ({ ...r, url: link(c.req.url, r) })));
});

app.delete('/api/files/:id', async (c) => {
  const u = c.get('user');
  const r = await c.env.DB.prepare('SELECT * FROM drop_files WHERE id = ?').bind(c.req.param('id')).first<Row>();
  if (!r || (r.user_id !== u.id && !u.isAdmin)) fail(404, 'Not found');
  await drop(c.env, r!);
  return c.body(null, 204);
});

export const tool: Tool = {
  name: 'drop',
  title: 'Drop',
  blurb: 'Share files, links expire',
  icon: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>',
  note: 'Download links are public until they expire. Upload needs sign-in.',
  app,
};

/** Daily cleanup of expired files (the Worker's scheduled() export calls this). */
export const sweepDrop = async (env: Env) => {
  const { results } = await env.DB.prepare('SELECT id, r2_key FROM drop_files WHERE expires_at <= ? LIMIT 1000').bind(Date.now()).all<Row>(); // ponytail: 1000/day cap, next run continues
  if (!results.length) return;
  await env.DROP.delete(results.map((r) => r.r2_key));
  await env.DB.batch(results.map((r) => env.DB.prepare('DELETE FROM drop_files WHERE id = ?').bind(r.id)));
};
