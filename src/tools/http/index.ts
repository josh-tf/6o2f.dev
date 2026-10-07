import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { bodyLimit } from 'hono/body-limit';
import { fail, gate, page, type AppEnv } from '../../auth.ts';
import { safeFetch } from '../../net.ts';
import type { Tool } from '../types.ts';
import { cleanHeaders, METHODS } from './logic.ts';

const app = new Hono<AppEnv>();
app.onError((e, c) => (e instanceof HTTPException ? c.json({ error: e.message }, e.status) : (console.error(e), c.json({ error: 'Internal error' }, 500))));
app.get('/', gate, (c) => page(c, 'http'));

app.post('/api/send', gate, bodyLimit({ maxSize: 128 * 1024, onError: (c) => c.json({ error: 'Request too large' }, 413) }), async (c) => {
  const b = await c.req.json<{ method?: string; url?: string; headers?: unknown; body?: string }>().catch(() => fail(400, 'Invalid JSON'));
  const method = String(b.method ?? 'GET').toUpperCase();
  if (!METHODS.includes(method)) fail(400, 'Method not allowed');
  const headers = cleanHeaders(b.headers ?? []);
  if (typeof headers === 'string') return fail(400, headers);
  if (!headers.some(([k]) => k.toLowerCase() === 'user-agent')) headers.push(['user-agent', '6o2f-http/1.0']);
  const body = method === 'GET' || method === 'HEAD' || !b.body ? undefined : String(b.body);
  const r = await safeFetch(String(b.url ?? ''), { method, headers, body });
  return c.json({
    status: r.res.status,
    statusText: r.res.statusText,
    ms: r.ms,
    chain: r.chain,
    truncated: r.truncated,
    headers: [...r.res.headers],
    size: new TextEncoder().encode(r.text).length,
    body: r.text,
  });
});

export const tool: Tool = {
  name: 'http',
  title: 'HTTP',
  blurb: 'Send test requests',
  icon: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/>',
  note: 'Needs sign-in. Requests go out from our servers; private and internal addresses are refused.',
  app,
};
