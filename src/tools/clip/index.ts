import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { bodyLimit } from 'hono/body-limit';
import { fail, gate, page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';
import { MAX_BYTES, byteLength, newId, ttlSeconds } from './logic.ts';

// KV layout: c:<userId>:<id> = text with metadata {created, expires, size, preview}. Ids sort newest first, so list() is the history.
const app = new Hono<AppEnv>();
app.onError((e, c) => (e instanceof HTTPException ? c.json({ error: e.message }, e.status) : (console.error(e), c.json({ error: 'Internal error' }, 500))));
app.use('*', gate);
app.get('/', (c) => page(c, 'clip'));

type Meta = { created: number; expires: number; size: number; preview: string };
const prefix = (c: { get: (k: 'user') => { id: string } }) => `c:${c.get('user').id}:`;
const raw = (c: { body: (t: string, s: 200, h: Record<string, string>) => Response }, text: string) =>
  c.body(text, 200, { 'content-type': 'text/plain; charset=utf-8', 'content-security-policy': 'sandbox', 'cache-control': 'no-store' });

app.post('/api/clips', bodyLimit({ maxSize: MAX_BYTES + 4096, onError: (c) => c.json({ error: 'Clip too large (max 64KB)' }, 413) }), async (c) => {
  let text: string,
    ttl = c.req.query('ttl');
  if (c.req.header('content-type')?.includes('json')) {
    const b = await c.req.json<{ text?: unknown; ttl?: unknown }>().catch(() => fail(400, 'Invalid JSON'));
    if (typeof b?.text !== 'string') return fail(400, 'text must be a string');
    text = b.text;
    ttl ??= b.ttl as string | undefined;
  } else text = await c.req.text();
  const secs = ttlSeconds(ttl);
  if (!secs) return fail(400, 'ttl must be 10m, 1h or 1d');
  const size = byteLength(text);
  if (size > MAX_BYTES) return fail(413, 'Clip too large (max 64KB)');
  if (!text) return fail(400, 'Empty clip');
  const id = newId(),
    now = Date.now();
  await c.env.CLIP.put(prefix(c) + id, text, {
    expirationTtl: secs,
    metadata: { created: now, expires: now + secs * 1000, size, preview: text.slice(0, 80) } satisfies Meta,
  });
  return c.json({ id }, 201);
});

app.get('/api/clips', async (c) => {
  const { keys } = await c.env.CLIP.list<Meta>({ prefix: prefix(c), limit: 20 });
  return c.json(keys.map((k) => ({ id: k.name.split(':')[2], ...k.metadata })));
});

app.get('/api/clips/latest', async (c) => {
  const { keys } = await c.env.CLIP.list({ prefix: prefix(c), limit: 1 });
  const text = keys[0] && (await c.env.CLIP.get(keys[0].name));
  return text == null ? fail(404, 'No clips') : raw(c, text);
});

const id = '/api/clips/:id{[0-9]{13}-[a-z0-9]{6}}';
app.get(id, async (c) => {
  const text = await c.env.CLIP.get(prefix(c) + c.req.param('id'));
  return text === null ? fail(404, 'Not found') : raw(c, text);
});
app.delete(id, async (c) => {
  await c.env.CLIP.delete(prefix(c) + c.req.param('id'));
  return c.body(null, 204);
});

export const tool: Tool = {
  name: 'clip',
  title: 'Clipboard',
  blurb: 'Copy here, paste on any device',
  icon: '<rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 4H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4"/><rect x="13" y="11" width="8" height="11" rx="1"/>',
  note: 'Needs sign-in (browser or API token). Clips are private to you and expire after 10 minutes to 1 day.',
  app,
};
