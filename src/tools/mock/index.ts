import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';
import { plan } from './logic.ts';

const cors = {
  'access-control-allow-origin': '*',
  'access-control-expose-headers': 'retry-after',
  'cache-control': 'no-store',
};
const json = (o: unknown, status = 200, extra: HeadersInit = {}) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, 'content-type': 'application/json', ...extra } });

// Reads at most `max` bytes so a huge upload cannot be buffered.
async function readCapped(req: Request, max: number) {
  const r = req.body?.getReader();
  const chunks: Uint8Array[] = [];
  let n = 0;
  while (r && n < max) {
    const { done, value } = await r.read();
    if (done) break;
    chunks.push(value);
    n += value.length;
  }
  r?.cancel().catch(() => {});
  const all = new Uint8Array(n);
  let o = 0;
  for (const c of chunks) all.set(c, (o += c.length) - c.length);
  return new TextDecoder().decode(all.subarray(0, max));
}

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'mock'));

app.options('/s/:status', preflight);
app.options('/echo/*', preflight);
function preflight(c: { req: { header(n: string): string | undefined } }) {
  return new Response(null, {
    status: 204,
    headers: {
      ...cors,
      'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS',
      'access-control-allow-headers': c.req.header('access-control-request-headers') ?? '*',
      'access-control-max-age': '86400',
    },
  });
}

app.all('/s/:status', async (c) => {
  const p = plan(c.req.param('status'), new URL(c.req.url).searchParams);
  if (typeof p === 'string') return json({ error: p }, 400);
  if (p.delay) await new Promise((r) => setTimeout(r, p.delay));
  const headers: Record<string, string> = { ...cors };
  if (p.body !== null) headers['content-type'] = p.json ? 'application/json' : 'text/plain; charset=utf-8';
  if (p.retry) headers['retry-after'] = p.retry;
  return new Response(p.body, { status: p.status, headers });
});

app.all('/echo/*', async (c) => {
  const u = new URL(c.req.url);
  const headers = Object.fromEntries([...c.req.raw.headers].filter(([k]) => k !== 'cookie' && k !== 'authorization'));
  return json({
    method: c.req.method,
    path: u.pathname,
    query: Object.fromEntries(u.searchParams),
    headers,
    body: await readCapped(c.req.raw, 65_536), // ponytail: truncated silently at 64KB
  });
});

app.all('*', () => json({ error: 'Not found' }, 404));

export const tool: Tool = {
  name: 'mock',
  title: 'Mock API',
  blurb: 'Fake delays and failures',
  public: true,
  icon: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  note: 'Public, no sign-in: the builder and the mock endpoints.',
  app,
};
