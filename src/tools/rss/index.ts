import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { fail, gate, page, type AppEnv } from '../../auth.ts';
import { checkUrl, safeFetch } from '../../net.ts';
import type { Tool } from '../types.ts';
import { parseFeed } from './parse.ts';

const MAX_FEEDS = 20;
const app = new Hono<AppEnv>();
app.onError((e, c) => (e instanceof HTTPException ? c.json({ error: e.message }, e.status) : (console.error(e), c.json({ error: 'Internal error' }, 500))));
app.use('*', gate);
app.get('/', (c) => page(c, 'rss'));

const ACCEPT = { accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5', 'user-agent': '6o2f-rss/1.0' };
async function load(url: string) {
  const { res, text } = await safeFetch(url, { maxBytes: 256 * 1024, headers: ACCEPT }); // a truncated feed still parses: its items up to the cap
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const feed = parseFeed(text, res.url || url);
  if (!feed) throw new Error('Not an RSS or Atom feed');
  return feed;
}
const why = (e: unknown) => (e instanceof Error ? e.message : 'Failed');

app.get('/api/feeds', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT id, url, title, created_at FROM rss_feeds WHERE user_id = ? ORDER BY created_at')
    .bind(c.get('user').id)
    .all();
  return c.json(results);
});

app.post('/api/feeds', async (c) => {
  const uid = c.get('user').id;
  const body = await c.req.json<{ url?: unknown }>().catch(() => null);
  if (typeof body?.url !== 'string') return fail(400, 'url required');
  const url = checkUrl(body.url.trim()).href;
  const n = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM rss_feeds WHERE user_id = ?').bind(uid).first<{ n: number }>();
  if ((n?.n ?? 0) >= MAX_FEEDS) return fail(409, `Limit of ${MAX_FEEDS} feeds reached`);
  const feed = await load(url).catch((e) => fail(400, why(e)));
  const id = crypto.randomUUID(),
    title = feed.title.slice(0, 200) || new URL(url).hostname;
  const r = await c.env.DB.prepare('INSERT OR IGNORE INTO rss_feeds (id, user_id, url, title, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, uid, url, title, Date.now())
    .run();
  if (!r.meta.changes) return fail(409, 'Already subscribed to this feed');
  return c.json({ id, url, title }, 201);
});

app.delete('/api/feeds/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM rss_feeds WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  return c.body(null, 204);
});

app.get('/api/items', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT id, url, title FROM rss_feeds WHERE user_id = ?')
    .bind(c.get('user').id)
    .all<{ id: string; url: string; title: string | null }>();
  const settled = await Promise.allSettled(results.map((f) => load(f.url)));
  const items: { feed: string; source: string; title: string; link: string | null; date: string | null; snippet: string }[] = [];
  const errors: { feed: string; url: string; error: string }[] = [];
  settled.forEach((s, i) => {
    const f = results[i];
    if (s.status === 'rejected') return void errors.push({ feed: f.id, url: f.url, error: why(s.reason) });
    for (const it of s.value.items) items.push({ feed: f.id, source: f.title || s.value.title || new URL(f.url).hostname, ...it });
  });
  items.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')); // ISO dates sort as text; undated last
  return c.json({ items: items.slice(0, 200), errors });
});

export const tool: Tool = {
  name: 'rss',
  title: 'Feeds',
  blurb: 'Read RSS and Atom in one list',
  icon: '<path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/>',
  note: 'Needs sign-in. Your feed list is stored on your account; feeds are fetched by the server (public URLs only).',
  app,
};
