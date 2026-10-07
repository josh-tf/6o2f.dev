import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { fail, gate, page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';
import { checkTarget, randomSlug, RESERVED, SLUG, TTL } from './logic.ts';

// KV layout: l:<slug> = {url, owner}; u:<owner>:<slug> = url with metadata {created, exp}. Both share the expiry.
const app = new Hono<AppEnv>();
app.get('/', gate, (c) => page(c, 's'));

const api = new Hono<AppEnv>();
api.use('*', bodyLimit({ maxSize: 8 * 1024, onError: (c) => c.json({ error: 'Request body too large' }, 413) }));
api.use('*', gate);
api.post('/links', async (c) => {
  const u = c.get('user');
  const b = await c.req.json<{ url?: unknown; slug?: unknown; ttl?: unknown }>().catch(() => ({}) as Record<string, unknown>);
  const t = checkTarget(b.url, c.env.DOMAIN);
  if ('error' in t) return fail(400, t.error);
  const slug = b.slug == null || b.slug === '' ? randomSlug() : b.slug;
  if (typeof slug !== 'string' || !SLUG.test(slug)) return fail(400, 'slug must be 3-32 characters of A-Z a-z 0-9 _ -');
  if (RESERVED.has(slug)) return fail(400, 'That slug is reserved');
  const ttl = b.ttl == null || b.ttl === '' ? 'never' : String(b.ttl);
  if (!Object.hasOwn(TTL, ttl)) return fail(400, 'ttl must be 1d, 7d, 30d or never');
  // ponytail: get-then-put is not atomic, so two simultaneous claims of one slug can both succeed; KV has no CAS.
  if (await c.env.LINKS.get(`l:${slug}`)) return fail(409, 'Slug already taken');
  const seconds = TTL[ttl],
    now = Date.now(),
    exp = seconds ? now + seconds * 1000 : null;
  const opts = seconds ? { expirationTtl: seconds } : {};
  await Promise.all([
    c.env.LINKS.put(`l:${slug}`, JSON.stringify({ url: t.url, owner: u.id }), opts),
    c.env.LINKS.put(`u:${u.id}:${slug}`, t.url, { ...opts, metadata: { created: now, exp } }),
  ]);
  return c.json({ slug, short: `https://s.${c.env.DOMAIN}/${slug}` }, 201);
});
api.get('/links', async (c) => {
  const prefix = `u:${c.get('user').id}:`;
  const { keys } = await c.env.LINKS.list<{ created: number; exp: number | null }>({ prefix, limit: 500 }); // ponytail: 500 newest-by-key cap, paginate with cursor if anyone needs more
  const links = await Promise.all(
    keys.map(async (k) => ({
      slug: k.name.slice(prefix.length),
      url: await c.env.LINKS.get(k.name),
      created: k.metadata?.created ?? 0,
      exp: k.metadata?.exp ?? null,
    })),
  );
  return c.json(
    links
      .filter((l) => l.url)
      .sort((a, b) => b.created - a.created)
      .map((l) => ({ ...l, short: `https://s.${c.env.DOMAIN}/${l.slug}` })),
  );
});
api.delete('/links/:slug', async (c) => {
  const u = c.get('user'),
    slug = c.req.param('slug');
  const rec = await c.env.LINKS.get<{ owner: string }>(`l:${slug}`, 'json');
  if (!rec || (rec.owner !== u.id && !u.isAdmin)) return fail(404, 'No such link');
  await Promise.all([c.env.LINKS.delete(`l:${slug}`), c.env.LINKS.delete(`u:${rec.owner}:${slug}`)]);
  return c.body(null, 204);
});
app.route('/api', api);

// Public: the redirect itself.
app.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const rec = SLUG.test(slug) && !RESERVED.has(slug) ? await c.env.LINKS.get<{ url: string }>(`l:${slug}`, 'json') : null;
  if (!rec) return c.json({ error: 'Not found' }, 404);
  return c.redirect(rec.url, 302); // global middleware leaves cache-control: no-store in place
});

export const tool: Tool = {
  name: 's',
  title: 'Short links',
  blurb: 'Shorten any URL',
  icon: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  note: 'Short links redirect for anyone. Creating needs sign-in.',
  app,
};
