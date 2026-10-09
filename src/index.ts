// One Worker for all of 6o2f.dev: the apex is the dashboard + Discord login, <name>.6o2f.dev routes to src/tools/<name>.
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { HTTPException } from 'hono/http-exception';
import { auth, canUse, authenticate, avatarUrl, fail, gate, logout, sha256hex, type AppEnv } from './auth.ts';
import { byName, tools } from './tools/index.ts';
import type { Tool } from './tools/types.ts';
import { SEO } from './seo.ts';
import { settings, type ToolState } from './settings.ts';
import { botEvent, flag, holdFor, isFlagged, isTrap, MAZE, maze, mazeFormat, trapLink } from './guard.ts';
import { sweepDrop } from './tools/drop/index.ts';
import { runUptime } from './tools/uptime/index.ts';
import { dayOf, pruneStats, record } from './stats.ts';
import { receive, sweep } from './tools/mail/index.ts';

export { HookInbox } from './tools/hook/inbox.ts';
export { SendRoom } from './tools/send/room.ts';

const dash = new Hono<AppEnv>();
dash.route('/auth', auth);
// The launcher is public: signed-out visitors see every tool (private ones locked). The login page only shows sign-in errors.
dash.get('/', (c) => c.env.ASSETS.fetch(new Request(new URL(c.req.query('error') ? '/_/login/' : '/_/dash/', c.req.url))));
dash.get('/api/tools', async (c) => {
  const [u, st] = await Promise.all([authenticate(c).catch(() => null), settings(c.env)]);
  // Tools switched off in the admin panel are hidden from everyone but admins; maintenance ones stay listed with a flag.
  return c.json(
    tools
      .filter((t) => (u ? t.public || canUse(u, t.name) : t.name !== 'admin') && (u?.isAdmin || st.tools[t.name] !== 'off'))
      .map(({ name, title, blurb, icon, note, public: pub }) => ({
        name,
        title,
        blurb,
        icon,
        note,
        locked: !pub,
        state: st.tools[name] ?? null,
        url: `https://${name}.${c.env.DOMAIN}`,
      })),
  );
});

const api = new Hono<AppEnv>();
api.use('*', bodyLimit({ maxSize: 16 * 1024, onError: (c) => c.json({ error: 'Request body too large' }, 413) }));
api.use('*', gate);
api.get('/me', (c) => {
  const u = c.get('user');
  return c.json({ id: u.id, name: u.name, avatarUrl: avatarUrl(u), isAdmin: u.isAdmin, domain: c.env.DOMAIN });
});
api.post('/logout', logout);

api.get('/tokens', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT id, name, created_at, last_used_at FROM tokens WHERE user_id = ? ORDER BY created_at DESC')
    .bind(c.get('user').id)
    .all();
  return c.json(results);
});
api.post('/tokens', async (c) => {
  const u = c.get('user');
  if (u.via !== 'cookie') fail(403, 'Create tokens from the dashboard');
  if (!u.isAdmin && u.tools === '') fail(403, 'Not approved yet');
  const n = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM tokens WHERE user_id = ?').bind(u.id).first<number>('n');
  if ((n ?? 0) >= 20) fail(400, 'At most 20 tokens; delete one first');
  const name = String((await c.req.json<{ name?: string }>().catch(() => ({ name: '' }))).name ?? '')
    .trim()
    .slice(0, 60);
  if (!name) fail(400, 'Name required');
  const raw = new Uint8Array(24);
  crypto.getRandomValues(raw);
  const token = `6o2f_${btoa(String.fromCharCode(...raw))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')}`;
  const id = crypto.randomUUID();
  await c.env.DB.prepare('INSERT INTO tokens (id, user_id, name, hash, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, c.get('user').id, name, await sha256hex(token), Date.now())
    .run();
  return c.json({ id, name, token }, 201); // plaintext is shown once
});
api.delete('/tokens/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM tokens WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  return c.body(null, 204);
});

dash.route('/api', api);
dash.onError(onError); // dash is fetched directly too

const root = new Hono<AppEnv>();
// Usage analytics: one aggregate row update per Worker-handled request (see src/stats.ts).
root.use('*', async (c, next) => {
  const t0 = Date.now();
  await next();
  const host = (c.env.DEV && c.req.header('x-host')) || new URL(c.req.url).hostname;
  const tool = host === c.env.DOMAIN ? 'launcher' : host.endsWith(`.${c.env.DOMAIN}`) ? host.slice(0, -c.env.DOMAIN.length - 1) : '';
  const path = new URL(c.req.url).pathname;
  // 404s are not recorded: junk paths would otherwise each cost D1 writes (and stats_path rows).
  if (
    c.get('bot') ||
    (tool !== 'launcher' && !byName.has(tool)) ||
    /^\/(_me|_logout|favicon\.|robots\.txt|sitemap\.xml)/.test(path) ||
    c.req.method === 'OPTIONS' ||
    c.res.status === 404
  )
    return;
  c.executionCtx.waitUntil(
    record(c.env, {
      tool,
      method: c.req.method,
      path,
      status: c.res.status,
      ms: Date.now() - t0,
      accept: c.req.header('accept') ?? '',
      ip: c.req.header('cf-connecting-ip') ?? '',
      ua: c.req.header('user-agent') ?? '',
      country: (c.req.raw.cf?.country as string) ?? '',
    }),
  );
});
root.use('*', async (c, next) => {
  await next();
  if (c.res.status === 101) return; // WebSocket upgrade: must be returned untouched
  // ASSETS responses have immutable headers: rebuild before adding ours.
  c.res = new Response(c.res.body, c.res);
  const h = c.res.headers;
  h.set('x-content-type-options', 'nosniff');
  h.set('referrer-policy', 'same-origin');
  h.set('strict-transport-security', 'max-age=63072000; includeSubDomains');
  h.set('permissions-policy', 'camera=(self), microphone=(), geolocation=(), payment=()');
  h.set('cross-origin-opener-policy', 'same-origin');
  if (!h.has('cache-control')) h.set('cache-control', 'no-store');
  if (!h.has('content-security-policy'))
    h.set(
      'content-security-policy',
      // Keep the HTML CSP identical to the /_/* one in public/_headers (static files skip this middleware).
      (h.get('content-type') ?? '').startsWith('text/html')
        ? "default-src 'self'; script-src 'self' 'sha256-YynjG5lDd9Ulbw7xL2D8gfwkg3qBmx2fWH1xigAR1nM=' https://static.cloudflareinsights.com; connect-src 'self' wss://*.6o2f.dev https://cloudflareinsights.com; img-src 'self' data: https://cdn.discordapp.com; font-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self' https://discord.com"
        : "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    );
});
// Same-origin identity + sign-out for the shared top bar on every host (cross-origin fetches are blocked by CSP).
// Bot guard (src/guard.ts): honeypot paths flag the IP; flagged IPs get the labyrinth instead of the site. Signed-in users pass.
root.use('*', async (c, next) => {
  const path = new URL(c.req.url).pathname,
    ip = c.req.header('cf-connecting-ip') ?? '';
  const trap = isTrap(path);
  if (!trap && !(await isFlagged(c.env, ip))) return next();
  if (await authenticate(c).catch(() => null)) return trap ? c.json({ error: 'Not found' }, 404) : next();
  c.set('bot', true);
  const country = (c.req.raw.cf?.country as string) ?? '',
    ua = c.req.header('user-agent') ?? '';
  const kind = !trap ? 'flagged' : path.startsWith(MAZE) ? 'maze' : 'trap',
    fmt = mazeFormat(path, c.req.header('accept') ?? ''),
    held = fmt ? holdFor(ip, path) : 0;
  // Honeypot hits (not maze pages) are also counted per path per day (stats_dim kind 'trap') for the trend.
  c.executionCtx.waitUntil(
    Promise.all([
      kind === 'trap'
        ? flag(c.env, ip, { path, country, ua })
        : kind === 'maze' && !(await isFlagged(c.env, ip))
          ? flag(c.env, ip, { path, country, ua })
          : null,
      kind === 'trap'
        ? c.env.DB.prepare("INSERT INTO stats_dim (day, kind, key, n) VALUES (?1, 'trap', ?2, 1) ON CONFLICT(day, kind, key) DO UPDATE SET n = n + 1")
            .bind(dayOf(), `/${path.split('/')[1]}`.slice(0, 40))
            .run()
        : null,
      botEvent(c.env, { ip, host: hostOf(c), method: c.req.method, path, kind, country, ua, fmt, held }),
    ]).catch((e) => console.error('guard', e)),
  );
  return fmt ? maze(path, fmt, hostOf(c), held) : c.json({ error: 'Forbidden' }, 403);
});
root.get('/_me', async (c) => {
  const u = await authenticate(c).catch(() => null);
  return c.json(u ? { id: u.id, name: u.name, avatarUrl: avatarUrl(u), isAdmin: u.isAdmin, noAccess: !u.isAdmin && u.tools === '', domain: c.env.DOMAIN } : {});
});
root.post('/_logout', gate, logout);
// One favicon for every host (browsers also probe /favicon.ico).
root.get('/favicon.svg', (c) => c.env.ASSETS.fetch(new Request(new URL('/_/favicon.svg', c.req.url))));
root.get('/favicon.ico', (c) => c.redirect('/favicon.svg', 301));
// Crawlers: every host gets its own robots.txt (locked tools are gated, so keep bots out); one sitemap on the apex lists the public pages.
const hostOf = (c: Context<AppEnv>) => (c.env.DEV && c.req.header('x-host')) || new URL(c.req.url).hostname;
root.get('/robots.txt', (c) => {
  const host = hostOf(c),
    t = byName.get(host.slice(0, -c.env.DOMAIN.length - 1));
  const open = host === c.env.DOMAIN || !!t?.public;
  return c.text(`User-agent: *\n${open ? `Allow: /\nDisallow: ${MAZE}` : 'Disallow: /'}\n\nSitemap: https://${c.env.DOMAIN}/sitemap.xml\n`, 200, {
    'cache-control': 'public, max-age=3600',
  });
});
root.get('/sitemap.xml', (c) => {
  if (hostOf(c) !== c.env.DOMAIN) return c.notFound();
  const urls = [`https://${c.env.DOMAIN}/`, ...tools.filter((t) => t.public).map((t) => `https://${t.name}.${c.env.DOMAIN}/`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`;
  return c.body(xml, 200, { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' });
});
/** Adds the standard <head> metadata (description, theme colour, Open Graph, canonical, noindex for sign-in tools) to every HTML page, so tool pages stay free of boilerplate. */
function decorate(res: Response, t: Tool | undefined, host: string, path: string): Response {
  if (res.status !== 200 || !(res.headers.get('content-type') ?? '').startsWith('text/html')) return res;
  const a = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const seo = t && SEO[t.name];
  const title = seo ? `${seo[0]} | 6o2f.dev` : t ? `${t.title} · dev@6o2f` : 'dev@6o2f: free developer tools in your browser';
  const desc = seo
    ? seo[1]
    : t
      ? `${t.title}: ${t.blurb}. ${t.public ? 'Free, no sign-in needed.' : 'Sign-in required.'}`
      : 'Free, fast developer tools: JSON, Base64, regex, JWT, UUID, hashes, CIDR, cron, colors, QR codes and more. Most run entirely in your browser.';
  const root = path === '/',
    url = `https://${host}/`;
  // Only a public tool's home page is indexable: locked tools are gated, and share pages (vote /p/<id>, countdown /c/<id>) are user content.
  const index = root && (!t || t.public);
  // JSON-LD is a data block, not script, so the CSP doesn't apply to it. </ is escaped so text can't close the tag.
  const ld =
    t && index
      ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebApplication', name: seo ? seo[0] : t.title, description: desc, url, applicationCategory: 'DeveloperApplication', operatingSystem: 'Any', browserRequirements: 'Requires JavaScript', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } }).replace(/</g, '\\u003c')}</script>`
      : '';
  const out = new HTMLRewriter()
    .on('title', {
      element(e) {
        e.setInnerContent(title);
      },
    })
    .on('body', {
      element(e) {
        e.append(trapLink(host + path), { html: true });
      },
    }) // honeypot link, see src/guard.ts
    .on('head', {
      element(e) {
        e.append(
          `<meta name="description" content="${a(desc)}"><meta name="color-scheme" content="dark light"><meta name="theme-color" content="#0a0e0b" media="(prefers-color-scheme: dark)"><meta name="theme-color" content="#f4f7f4" media="(prefers-color-scheme: light)">` +
            `<meta property="og:title" content="${a(title)}"><meta property="og:description" content="${a(desc)}"><meta property="og:type" content="website"><meta name="twitter:card" content="summary_large_image"><meta property="og:image" content="https://${a(host.split('.').slice(-2).join('.'))}/_/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="dev@6o2f: free developer tools, in your browser">` +
            `<meta property="og:site_name" content="6o2f.dev">` +
            // canonical/og:url only on the tool's home page: share pages are not copies of it
            (root ? `<meta property="og:url" content="${a(url)}"><link rel="canonical" href="${a(url)}">` : '') +
            (index ? ld : '<meta name="robots" content="noindex">') +
            '<link rel="preload" href="/_/fonts/jetbrains-mono.woff2" as="font" type="font/woff2" crossorigin>',
          { html: true },
        );
      },
    })
    .transform(res);
  // The asset's ETag describes the undecorated file (and was never answered with 304), and pages may be gated: no caching.
  const r = new Response(out.body, out);
  r.headers.delete('etag');
  r.headers.set('cache-control', 'no-store');
  return r;
}
root.all('*', async (c) => {
  // Local `wrangler dev` always shows the route's host; DEV=1 (.dev.vars only) lets tests pick one via x-host.
  const host = (c.env.DEV && c.req.header('x-host')) || new URL(c.req.url).hostname;
  if (host === c.env.DOMAIN) return decorate(await dash.fetch(c.req.raw, c.env, c.executionCtx), undefined, host, c.req.path);
  const tool = host.endsWith(`.${c.env.DOMAIN}`) ? byName.get(host.slice(0, -c.env.DOMAIN.length - 1)) : undefined;
  if (!tool) return c.json({ error: 'Not found' }, 404);
  const state = tool.name === 'admin' ? undefined : (await settings(c.env)).tools[tool.name];
  // Off or in maintenance: everyone but admins gets a 503 (admins pass, so they can check the tool before switching it back on).
  if (state && !(await authenticate(c).catch(() => null))?.isAdmin) return unavailable(c, tool, state);
  return decorate(await tool.app.fetch(c.req.raw, c.env, c.executionCtx), tool, host, c.req.path);
});
function unavailable(c: Context<AppEnv>, t: Tool, state: ToolState) {
  const msg = state === 'off' ? `${t.title} is switched off.` : `${t.title} is down for maintenance. Try again soon.`;
  const headers = { 'retry-after': '600', 'cache-control': 'no-store' };
  if (!c.req.header('accept')?.includes('text/html')) return c.json({ error: msg }, 503, headers);
  const a = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return c.html(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${a(t.title)} · unavailable</title><link rel="stylesheet" href="/_/ui.css"></head>
<body><main><h1>${a(t.title)}</h1><p class="sub">${a(msg)}</p><p><a href="https://${a(c.env.DOMAIN)}/">Back to all tools</a></p></main></body></html>`,
    503,
    headers,
  );
}
function onError(err: Error, c: Context) {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: 'Internal error' }, 500);
}
root.onError(onError);
for (const t of tools) t.app.onError(onError); // tool apps are fetched directly, so root's handler doesn't reach them

export default {
  fetch: root.fetch,
  email: receive,
  scheduled: (event, env, ctx) =>
    void ctx.waitUntil(event.cron === '*/5 * * * *' ? runUptime(env) : Promise.all([sweep(env), sweepDrop(env), pruneStats(env)])),
} satisfies ExportedHandler<Env>;
