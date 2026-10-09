// Bot guard. Honeypots flag an IP for 24 h: scanner paths (/.env, /wp-login.php, ...) on any host, and a hidden link in
// every page to MAZE, which robots.txt disallows (so polite crawlers never follow it). A flagged IP gets an endless, slow,
// generated labyrinth instead of the site; signed-in users always pass (a flagged IP can be shared with a real person).
// IPv6 is flagged per /64, since one host usually has a whole /64. Flags live in KV (GUARD) as ban:<ip> with a 24 h TTL.

export const MAZE = '/__maze/';
const TTL = 86400;
const TRAPS =
  /^\/(\.env|\.git\/|\.hg\/|\.bzr\/|\.idea\/|\.npmrc|\.aws\/|\.ssh\/|\.svn\/|\.htpasswd|\.DS_Store|wp-(login|admin|content|includes|config)|xmlrpc\.php|phpmyadmin|pma\/|myadmin|adminer|admin\.php|config\.php|phpinfo|info\.php|server-status|vendor\/phpunit|cgi-bin\/|boaform|actuator\/|\.vscode\/|telescope\/|_ignition|backup\.(zip|sql|tar|gz)|db\.sql|dump\.sql)/i;

export const isTrap = (path: string) => path.startsWith(MAZE) || TRAPS.test(path);

/** Expands an IPv6 address to 8 groups. */
const expand6 = (ip: string) => {
  const [a, b = ''] = ip.split('::'),
    head = a ? a.split(':') : [],
    tail = b ? b.split(':') : [];
  return ip.includes('::') ? [...head, ...Array(8 - head.length - tail.length).fill('0'), ...tail] : ip.split(':');
};
/** The unit we flag: the IPv4 address, or the IPv6 /64. */
export const ipKey = (ip: string) =>
  ip.includes(':')
    ? `${expand6(ip)
        .slice(0, 4)
        .map((g) => g.toLowerCase().replace(/^0+(?=.)/, ''))
        .join(':')}::/64`
    : ip;

// ponytail: per-isolate 60 s cache of lookups, so a busy client costs one KV read a minute; capped at 5,000 entries.
const seen = new Map<string, { banned: boolean; at: number }>();
export async function isFlagged(env: Env, ip: string): Promise<boolean> {
  if (!ip) return false;
  const k = ipKey(ip),
    c = seen.get(k);
  if (c && Date.now() - c.at < 60_000) return c.banned;
  const banned = (await env.GUARD.get(`ban:${k}`, { cacheTtl: 60 })) !== null;
  if (seen.size > 5000) seen.clear();
  seen.set(k, { banned, at: Date.now() });
  return banned;
}

export type Flag = { path: string; at: number; country: string; ua: string };
export async function flag(env: Env, ip: string, f: Omit<Flag, 'at'>) {
  if (!ip) return;
  const k = ipKey(ip);
  seen.set(k, { banned: true, at: Date.now() });
  await env.GUARD.put(`ban:${k}`, '', {
    expirationTtl: TTL,
    metadata: { ...f, path: f.path.slice(0, 80), ua: f.ua.slice(0, 120), at: Date.now() } satisfies Flag,
  });
}
export async function unflag(env: Env, key: string) {
  for (const [k] of seen) if (k === key) seen.delete(k);
  await env.GUARD.delete(`ban:${key}`);
}
export async function flagged(env: Env) {
  const { keys, list_complete } = await env.GUARD.list<Flag>({ prefix: 'ban:' }); // ponytail: first 1000
  return {
    items: keys.map((k) => ({ ip: k.name.slice(4), expires: (k.expiration ?? 0) * 1000, ...k.metadata })).sort((a, b) => (b.at ?? 0) - (a.at ?? 0)),
    truncated: !list_complete,
  };
}

/* ---------- labyrinth ---------- */
const WORDS = (
  'archive index report quarterly summary analysis revision draft appendix schema record ledger protocol registry ' +
  'module catalogue reference annex volume series dataset partition manifest digest bulletin notice memo minutes ' +
  'framework overview legacy internal regional review pending approved migration batch cluster segment'
).split(' ');
/** Small seeded PRNG (mulberry32) so a maze URL always renders the same page. */
const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** A labyrinth page's content: the same path always gives the same title, filler and 8 onward links (8-hex-digit ids under MAZE). */
export function mazePage(path: string) {
  const r = rng(hash(path)),
    pick = () => WORDS[Math.floor(r() * WORDS.length)];
  const sentence = () => {
    const w = Array.from({ length: 8 + Math.floor(r() * 10) }, pick).join(' ');
    return w[0].toUpperCase() + w.slice(1) + '.';
  };
  const title = `${pick()} ${pick()} ${1990 + Math.floor(r() * 35)}`.replace(/^./, (c) => c.toUpperCase());
  const links = Array.from({ length: 8 }, () => ({
    id: Math.floor(r() * 2 ** 32)
      .toString(16)
      .padStart(8, '0'),
    label: `${pick()} ${pick()}`,
  }));
  const body = Array.from({ length: 4 }, () => `<p>${Array.from({ length: 4 }, sentence).join(' ')}</p>`).join('');
  return { title, links, body, delay: 1500 + r() * 1500 };
}

/** An endless page of plausible filler linking to more of the same. Slow on purpose (1.5-3 s): it costs us wall time, not CPU. */
export async function maze(path: string): Promise<Response> {
  const { title, links, body, delay } = mazePage(path);
  const list = links.map((l) => `<li><a href="${MAZE}${l.id}">${l.label} ${l.id.slice(0, 4)}</a></li>`).join('');
  await new Promise((res) => setTimeout(res, delay));
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>${title}</title></head><body><h1>${title}</h1>${body}<ul>${list}</ul></body></html>`,
    {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' },
    },
  );
}

/** The hidden link added to every page: invisible, out of the tab order and the accessibility tree. */
export const trapLink = (seed: string) => `<a href="${MAZE}${hash(seed).toString(16)}" hidden aria-hidden="true" tabindex="-1" rel="nofollow">archive</a>`;

/* ---------- activity ---------- */
export type BotEvent = { ip: string; host: string; method: string; path: string; kind: 'trap' | 'maze' | 'flagged'; country: string; ua: string };
const LOG_PER_DAY = 50;
/** One counter upsert per bot request, plus a log row for the first LOG_PER_DAY requests of the IP each UTC day. */
export async function botEvent(env: Env, e: BotEvent) {
  const now = Date.now(),
    day = new Date(now).toISOString().slice(0, 10),
    ip = ipKey(e.ip),
    path = e.path.slice(0, 200);
  const r = await env.DB.prepare(
    `INSERT INTO bot_ips (ip, first_at, last_at, hits, traps, maze, day, day_hits, country, ua, first_path, last_path, last_host)
     VALUES (?1, ?2, ?2, 1, ?3, ?4, ?5, 1, ?6, ?7, ?8, ?8, ?9)
     ON CONFLICT(ip) DO UPDATE SET last_at = ?2, hits = hits + 1, traps = traps + ?3, maze = maze + ?4,
       day_hits = CASE WHEN day = ?5 THEN day_hits + 1 ELSE 1 END, day = ?5, country = ?6, ua = ?7, last_path = ?8, last_host = ?9
     RETURNING day_hits`,
  )
    .bind(ip, now, e.kind === 'trap' ? 1 : 0, e.kind === 'maze' ? 1 : 0, day, e.country, e.ua.slice(0, 300), path, e.host)
    .first<{ day_hits: number }>();
  if ((r?.day_hits ?? 0) <= LOG_PER_DAY)
    await env.DB.prepare('INSERT INTO bot_log (at, ip, host, method, path, kind) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(now, ip, e.host, e.method, path, e.kind)
      .run();
}
