import { Hono } from 'hono';
import { fail, gate, page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';
import { encodeBody, readCapped, safeHeaders } from './capture.ts';

const app = new Hono<AppEnv>();
const inbox = (env: Env, id: string) => env.HOOK.get(env.HOOK.idFromName(id));

// Public receiver. Unknown ids 404 before touching a Durable Object.
app.all('/h/:id/*', receive);
app.all('/h/:id', receive);
async function receive(c: import('hono').Context<AppEnv>) {
  const id = c.req.param('id')!;
  if (!(await c.env.DB.prepare('SELECT 1 FROM hook_endpoints WHERE id = ?').bind(id).first())) return c.json({ error: 'Not found' }, 404);
  const { bytes, truncated } = await readCapped(c.req.raw.body);
  const u = new URL(c.req.url);
  await inbox(c.env, id).add({
    ts: Date.now(),
    method: c.req.method,
    path: u.pathname + u.search,
    headers: safeHeaders(c.req.raw.headers),
    ip: c.req.header('cf-connecting-ip') ?? null,
    truncated,
    ...encodeBody(bytes),
  });
  return c.json({ ok: true });
}

app.get('/', gate, (c) => page(c, 'hook'));
app.use('/api/*', gate);

const owned = async (c: import('hono').Context<AppEnv>, id: string) => {
  if (!(await c.env.DB.prepare('SELECT 1 FROM hook_endpoints WHERE id = ? AND user_id = ?').bind(id, c.get('user').id).first())) fail(404, 'Not found');
};
const url = (c: import('hono').Context<AppEnv>, id: string) => `https://hook.${c.env.DOMAIN}/h/${id}`;

app.post('/api/hooks', async (c) => {
  const name =
    String((await c.req.json<{ name?: string }>().catch(() => ({}) as { name?: string })).name ?? '')
      .trim()
      .slice(0, 60) || null;
  const id = crypto.randomUUID().replaceAll('-', '');
  await c.env.DB.prepare('INSERT INTO hook_endpoints (id, user_id, name, created_at) VALUES (?, ?, ?, ?)').bind(id, c.get('user').id, name, Date.now()).run();
  return c.json({ id, name, url: url(c, id) }, 201);
});
app.get('/api/hooks', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT id, name, created_at FROM hook_endpoints WHERE user_id = ? ORDER BY created_at DESC')
    .bind(c.get('user').id)
    .all<{ id: string }>();
  return c.json(results.map((r) => ({ ...r, url: url(c, r.id) })));
});
app.delete('/api/hooks/:id', async (c) => {
  const id = c.req.param('id');
  await owned(c, id);
  await inbox(c.env, id).destroy();
  await c.env.DB.prepare('DELETE FROM hook_endpoints WHERE id = ?').bind(id).run();
  return c.body(null, 204);
});
app.get('/api/hooks/:id/requests', async (c) => {
  await owned(c, c.req.param('id'));
  return c.json(await inbox(c.env, c.req.param('id')).list(Number(c.req.query('since')) || 0));
});
app.delete('/api/hooks/:id/requests', async (c) => {
  await owned(c, c.req.param('id'));
  await inbox(c.env, c.req.param('id')).clear();
  return c.body(null, 204);
});

export const tool: Tool = {
  name: 'hook',
  title: 'Webhooks',
  blurb: 'Inspect incoming requests',
  icon: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  note: 'Receiver URLs are public. Viewing requests needs sign-in.',
  app,
};
