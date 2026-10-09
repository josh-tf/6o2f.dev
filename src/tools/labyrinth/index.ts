import { Hono } from 'hono';
import { adminOnly, fail, gate, page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';
import { crawlerFamily, flagged, mazeCost, mazeDoc, mazePage, unflag, type Fmt } from '../../guard.ts';

// The bot guard's dashboard (src/guard.ts does the trapping): stats, a live map of the labyrinth and a per-bot replay.
const app = new Hono<AppEnv>();
app.use('*', gate, adminOnly);
app.get('/', (c) => page(c, 'labyrinth'));

/** Bots tab: summary, bot IPs with what they did (last 7 days), honeypot paths, the latest events. */
app.get('/api/bots', async (c) => {
  const DB = c.env.DB,
    since = Date.now() - 7 * 86400_000,
    sinceDay = new Date(since).toISOString().slice(0, 10),
    today = new Date().toISOString().slice(0, 10);
  const q = async <T>(sql: string, ...b: unknown[]) =>
    (
      await DB.prepare(sql)
        .bind(...b)
        .all<T>()
    ).results;
  const [flags, ips, traps, recent, kinds, daily, byDay, countries, cost, uas] = await Promise.all([
    flagged(c.env),
    q('SELECT * FROM bot_ips WHERE last_at >= ? ORDER BY last_at DESC LIMIT 200', since),
    q("SELECT key, SUM(n) n FROM stats_dim WHERE kind = 'trap' AND day >= ? GROUP BY key ORDER BY n DESC LIMIT 20", sinceDay),
    q('SELECT * FROM bot_log ORDER BY id DESC LIMIT 200'),
    q('SELECT kind, COUNT(*) n FROM bot_log WHERE at >= ? GROUP BY kind', since),
    q("SELECT day, SUM(n) n FROM stats_dim WHERE kind = 'trap' AND day >= ? GROUP BY day", sinceDay),
    // Logged events per day and kind (the log keeps each IP's first 50 a day), plus distinct IPs per day.
    q("SELECT date(at / 1000, 'unixepoch') day, kind, COUNT(*) n, COUNT(DISTINCT ip) ips FROM bot_log WHERE at >= ? GROUP BY day, kind", since),
    q("SELECT COALESCE(NULLIF(country, ''), '??') key, COUNT(*) n FROM bot_ips WHERE last_at >= ? GROUP BY key ORDER BY n DESC LIMIT 12", since),
    q('SELECT COALESCE(SUM(bytes), 0) bytes, COALESCE(SUM(words), 0) words, COALESCE(SUM(held_ms), 0) held FROM bot_ips WHERE last_at >= ?', since),
    q<{ ua: string | null; hits: number; maze: number; bytes: number; held_ms: number }>(
      'SELECT ua, hits, maze, bytes, held_ms FROM bot_ips WHERE last_at >= ? LIMIT 20000', // ponytail: 20k IPs a week, then a GROUP BY in SQL
      since,
    ),
  ]);
  // Crawler families: IPs grouped by what their user agent says they are, most time held first.
  const byFamily = new Map<string, { name: string; type: string; ips: number; hits: number; maze: number; deepest: number; bytes: number; held: number }>();
  for (const r of uas) {
    const f = crawlerFamily(r.ua),
      a = byFamily.get(f.name) ?? { ...f, ips: 0, hits: 0, maze: 0, deepest: 0, bytes: 0, held: 0 };
    Object.assign(a, {
      ips: a.ips + 1,
      hits: a.hits + r.hits,
      maze: a.maze + r.maze,
      deepest: Math.max(a.deepest, r.maze),
      bytes: a.bytes + r.bytes,
      held: a.held + r.held_ms,
    });
    byFamily.set(f.name, a);
  }
  const days = Array.from({ length: 7 }, (_, i) => new Date(Date.now() - (6 - i) * 86400_000).toISOString().slice(0, 10));
  const bd = byDay as { day: string; kind: string; n: number; ips: number }[];
  const per = (kind: string) => days.map((d) => bd.find((r) => r.day === d && r.kind === kind)?.n ?? 0);
  const mz = (ips as { maze: number }[]).filter((r) => r.maze > 0);
  const fl = new Map(flags.items.map((f) => [f.ip, f.expires]));
  const k = Object.fromEntries((kinds as { kind: string; n: number }[]).map((r) => [r.kind, r.n]));
  return c.json({
    summary: {
      flaggedNow: flags.items.length,
      ips7: ips.length,
      trapsToday: (daily as { day: string; n: number }[]).find((d) => d.day === today)?.n ?? 0,
      traps7: (daily as { n: number }[]).reduce((a, d) => a + d.n, 0),
      mazeLogged7: k.maze ?? 0,
      flaggedLogged7: k.flagged ?? 0,
    },
    ips: (ips as Record<string, unknown>[]).map((r) => ({ ...r, flaggedUntil: fl.get(r.ip as string) ?? null })),
    flaggedOnly: flags.items.filter((f) => !(ips as { ip: string }[]).some((r) => r.ip === f.ip)),
    traps,
    recent,
    countries,
    daily: {
      days,
      trap: per('trap'),
      maze: per('maze'),
      flagged: per('flagged'),
      ips: days.map((d) => Math.max(0, ...bd.filter((r) => r.day === d).map((r) => r.ips))),
    },
    cost: cost[0],
    families: [...byFamily.values()].sort((a, b) => b.held - a.held || b.hits - a.hits).slice(0, 25),
    maze: { crawlers: mz.length, pages: mz.reduce((a, r) => a + r.maze, 0), deepest: Math.max(0, ...mz.map((r) => r.maze)) },
  });
});
/** Maze tab: logged bot requests after id `after` (first call: the last 24 h), oldest first, each with the page it was
 * served (title and onward link ids, so the client can rebuild who went where), plus the IPs' country and user agent. */
app.get('/api/bots/maze', async (c) => {
  const after = Number(c.req.query('after')) || 0,
    since = after ? 0 : Date.now() - 86400_000;
  const { results } = await c.env.DB.prepare(
    'SELECT l.id, l.at, l.ip, l.host, l.path, l.kind, i.country, i.ua, i.maze total, i.bytes, i.held_ms held FROM bot_log l LEFT JOIN bot_ips i ON i.ip = l.ip WHERE l.id > ? AND l.at >= ? ORDER BY l.id LIMIT 3000',
  )
    .bind(after, since)
    .all<{ path: string; ua: string | null }>();
  return c.json(
    results.map((r) => {
      const p = mazePage(r.path);
      return { ...r, title: p.title, links: p.links.map((l) => l.id), family: crawlerFamily(r.ua).name };
    }),
  );
});
/** Bot inspector: one IP's logged requests, oldest first, each with the page it was served (title, onward links, the
 * labyrinth's delay), plus its counters. The query string carries the IP because an IPv6 key holds a slash. */
app.get('/api/bots/timeline', async (c) => {
  const ip = c.req.query('ip') ?? '';
  const [bot, log] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM bot_ips WHERE ip = ?').bind(ip).first<{ ua: string | null }>(),
    c.env.DB.prepare('SELECT id, at, host, method, path, kind, fmt, held_ms FROM bot_log WHERE ip = ? ORDER BY id LIMIT 500')
      .bind(ip)
      .all<{ path: string; host: string; fmt: Fmt | null; held_ms: number | null }>(),
  ]);
  if (!bot) fail(404, 'No such bot');
  return c.json({
    bot: { ...bot, family: crawlerFamily(bot?.ua) },
    steps: log.results.map((r) => {
      const p = mazePage(r.path),
        fmt = r.fmt ?? (r.held_ms === null ? 'html' : null); // rows from before formats were logged all got HTML
      return {
        ...r,
        fmt,
        title: p.title,
        links: p.links.map((l) => l.id),
        delay: r.held_ms ?? Math.round(p.delay),
        ...(fmt ? mazeCost(r.path, fmt, r.host) : { bytes: 21, words: 0 }),
      };
    }),
  });
});
const escHtml = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
/** The exact document a bot got for a path, format and host, as HTML for the inspector's sandboxed frame. JSON and
 * text come as <pre> with their maze URLs linked, so the inspector can highlight the one followed next. */
app.get('/api/bots/page', (c) => {
  const path = c.req.query('path') ?? '/',
    fmt = (c.req.query('fmt') ?? 'html') as Fmt | 'none', // no fmt: a page cached from before formats existed, and everything then got HTML
    host = /^[a-z0-9.-]{1,100}$/i.test(c.req.query('host') ?? '') ? c.req.query('host')! : c.env.DOMAIN;
  if (fmt === 'html') return c.json({ html: mazeDoc(path, 'html', host) });
  const raw =
    fmt === 'json'
      ? JSON.stringify(JSON.parse(mazeDoc(path, 'json', host)), null, 2)
      : fmt === 'text'
        ? mazeDoc(path, 'text', host)
        : '{"error":"Forbidden"}  (HTTP 403)';
  const body = escHtml(raw).replace(/https:\/\/[a-z0-9.-]+\/__maze\/([0-9a-f]{8})/gi, (u, id) => `<a href="/__maze/${id}">${u}</a>`);
  return c.json({
    html: `<!doctype html><html><head><meta charset="utf-8"></head><body><pre style="white-space:pre-wrap;font:13px/1.5 ui-monospace,monospace">${body}</pre></body></html>`,
  });
});
app.get('/api/bots/:ip', async (c) => {
  const ip = decodeURIComponent(c.req.param('ip'));
  const { results } = await c.env.DB.prepare('SELECT * FROM bot_log WHERE ip = ? ORDER BY id DESC LIMIT 200').bind(ip).all();
  return c.json(results);
});
/** Unflag an IP (logged in the admin audit log like every other admin change). */
app.delete('/api/guard/:ip', async (c) => {
  const ip = decodeURIComponent(c.req.param('ip'));
  if (!/^[0-9a-f.:/]{3,60}$/i.test(ip)) fail(400, 'Bad IP');
  await unflag(c.env, ip);
  await c.env.DB.prepare('INSERT INTO admin_log (at, admin_id, action, target, detail) VALUES (?, ?, ?, NULL, ?)')
    .bind(Date.now(), c.get('user').id, 'guard.unflag', JSON.stringify({ ip }))
    .run();
  return c.body(null, 204);
});

export const tool: Tool = {
  name: 'labyrinth',
  title: 'Labyrinth',
  blurb: 'Bots stuck in the maze',
  icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v10h4M15 21v-8h-4M11 7h6v6"/>',
  note: 'Admins only.',
  app,
};
