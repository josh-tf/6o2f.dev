// Privacy-light usage analytics. Everything is an aggregate counter in D1; visitors are a per-day salted hash, never an IP or user agent.
// Only requests that reach the Worker are counted (static files under /_/ never do).

export const dayOf = (d = new Date()) => d.toISOString().slice(0, 10);
export const addDays = (day: string, n: number) => dayOf(new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400_000));

/** Coarse browser family and device class from a User-Agent. */
export function uaInfo(ua: string): { browser: string; device: string; bot: boolean } {
  if (/bot|spider|crawl|slurp|preview|facebookexternalhit|monitor|uptime|headless/i.test(ua)) return { browser: 'bot', device: 'bot', bot: true };
  if (!ua || /^(curl|wget|python|node|go-http|okhttp|axios|undici|libwww|java|ruby|php|postman)/i.test(ua))
    return { browser: 'cli', device: 'cli', bot: false };
  const browser = /edg\//i.test(ua)
    ? 'Edge'
    : /opr\/|opera/i.test(ua)
      ? 'Opera'
      : /firefox|fxios/i.test(ua)
        ? 'Firefox'
        : /chrome|crios/i.test(ua)
          ? 'Chrome'
          : /safari/i.test(ua)
            ? 'Safari'
            : 'Other';
  const device = /ipad|tablet/i.test(ua) ? 'tablet' : /mobi|android|iphone/i.test(ua) ? 'mobile' : 'desktop';
  return { browser, device, bot: false };
}

const KNOWN = new Set(['api', 'json', 'headers', 'ws', 'h', 'd', 's', 'og', 'img', 'send']);
/** Low-cardinality path: ids become :id, unknown first segments collapse to /:x, at most four segments.
 *  Error responses (err) keep only the first segment, so junk paths cannot each add a row. */
export function pathKey(path: string, err = false): string {
  const seg = path.split('/').filter(Boolean).slice(0, 4);
  if (!seg.length) return '/';
  if (!KNOWN.has(seg[0])) return '/:x';
  if (err && seg.length > 1) return `/${seg[0]}/:x`;
  return (
    '/' +
    seg
      .map((s, i) => (i === 0 ? s : /^\d+$/.test(s) ? ':n' : /^[A-Za-z0-9_-]{8,}$/.test(s) && (/\d/.test(s) || s.length >= 16) ? ':id' : s.slice(0, 24)))
      .join('/')
  );
}

async function visitorHash(ip: string, ua: string, day: string, secret: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ip}|${ua}|${day}|${secret}`));
  return [...new Uint8Array(d)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export type Hit = { tool: string; method: string; path: string; status: number; ms: number; accept: string; ip: string; ua: string; country: string };

/** Records one request. Never throws: analytics must not affect a response. */
export async function record(env: Env, h: Hit): Promise<void> {
  try {
    const day = dayOf(),
      u = uaInfo(h.ua),
      db = env.DB;
    const view = h.method === 'GET' && h.accept.includes('text/html') && h.status === 200 && !u.bot;
    const st = [
      db
        .prepare(
          'INSERT INTO stats_daily (day, tool, hits, err4, err5, ms) VALUES (?1, ?2, 1, ?3, ?4, ?5) ON CONFLICT(day, tool) DO UPDATE SET hits = hits + 1, err4 = err4 + ?3, err5 = err5 + ?4, ms = ms + ?5',
        )
        .bind(day, h.tool, h.status >= 400 && h.status < 500 ? 1 : 0, h.status >= 500 ? 1 : 0, Math.max(0, Math.round(h.ms))),
      db
        .prepare(
          'INSERT INTO stats_path (day, tool, path, n, e4, e5) VALUES (?1, ?2, ?3, 1, ?4, ?5) ON CONFLICT(day, tool, path) DO UPDATE SET n = n + 1, e4 = e4 + ?4, e5 = e5 + ?5',
        )
        .bind(day, h.tool, pathKey(h.path, h.status >= 400), h.status >= 400 && h.status < 500 ? 1 : 0, h.status >= 500 ? 1 : 0),
    ];
    if (view) {
      const dim = (kind: string, key: string) =>
        db.prepare('INSERT INTO stats_dim (day, kind, key, n) VALUES (?1, ?2, ?3, 1) ON CONFLICT(day, kind, key) DO UPDATE SET n = n + 1').bind(day, kind, key);
      st.push(
        db
          .prepare('INSERT OR IGNORE INTO stats_visitor (day, tool, vh) VALUES (?, ?, ?)')
          .bind(day, h.tool, await visitorHash(h.ip, h.ua, day, env.SESSION_SECRET)),
        dim('country', h.country || '??'),
        dim('browser', u.browser),
        dim('device', u.device),
      );
    }
    await db.batch(st);
  } catch (e) {
    console.error('stats', e);
  }
}

/** Per-user request counter (called from the auth gate). */
export async function userHit(env: Env, userId: string, tool: string): Promise<void> {
  try {
    await env.DB.prepare('INSERT INTO stats_user (day, user_id, tool, n) VALUES (?1, ?2, ?3, 1) ON CONFLICT(day, user_id, tool) DO UPDATE SET n = n + 1')
      .bind(dayOf(), userId, tool || 'launcher')
      .run();
  } catch (e) {
    console.error('stats', e);
  }
}

/** Daily retention: visitor hashes 35 days, paths 60, bot log 7, bot IPs 30, everything else (admin log included) 400. */
export async function pruneStats(env: Env): Promise<void> {
  const t = dayOf();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM stats_visitor WHERE day < ?').bind(addDays(t, -35)),
    env.DB.prepare('DELETE FROM stats_path WHERE day < ?').bind(addDays(t, -60)),
    env.DB.prepare('DELETE FROM ai_usage WHERE day < ?').bind(addDays(t, -400)),
    env.DB.prepare('DELETE FROM admin_log WHERE at < ?').bind(Date.now() - 400 * 86400_000),
    env.DB.prepare('DELETE FROM bot_log WHERE at < ?').bind(Date.now() - 7 * 86400_000),
    env.DB.prepare('DELETE FROM bot_ips WHERE last_at < ?').bind(Date.now() - 30 * 86400_000),
    ...['stats_daily', 'stats_dim', 'stats_user'].map((x) => env.DB.prepare(`DELETE FROM ${x} WHERE day < ?`).bind(addDays(t, -400))),
  ]);
}
