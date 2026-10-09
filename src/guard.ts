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

const STATUS = ['active', 'pending', 'archived', 'approved', 'under review', 'superseded'];
/** The HTML of a labyrinth page, exactly as a bot is served it. Each path is one of three page types (a report, a
 * directory listing, a page of records) so the maze doesn't look like one template; all carry the same 8 links.
 * The type and its trimmings use their own PRNG, so mazePage (and with it the admin map) is unaffected by them. */
export function mazeHtml(path: string) {
  const { title, links, body } = mazePage(path),
    q = rng(hash(path) ^ 0x9e3779b9),
    n = (k: number) => Math.floor(q() * k),
    date = () => `${2016 + n(9)}-${String(1 + n(12)).padStart(2, '0')}-${String(1 + n(28)).padStart(2, '0')}`,
    href = (id: string) => `href="${MAZE}${id}"`,
    slug = (l: { label: string; id: string }) => `${l.label.replace(/ /g, '_')}_${l.id.slice(0, 4)}`;
  const type = q();
  let main;
  if (type < 0.5) main = `<h1>${title}</h1>${body}<ul>${links.map((l) => `<li><a ${href(l.id)}>${l.label} ${l.id.slice(0, 4)}</a></li>`).join('')}</ul>`;
  else if (type < 0.75) {
    const ext = ['/', '/', '/', '.pdf', '.csv', '.xlsx', '.sql.gz', '.zip'];
    const rows = links.map((l) => {
      const e = ext[n(ext.length)];
      return `<tr><td><a ${href(l.id)}>${slug(l)}${e}</a></td><td>${date()} ${String(n(24)).padStart(2, '0')}:${String(n(60)).padStart(2, '0')}</td><td align="right">${e === '/' ? '-' : `${(1 + q() * 90).toFixed(1)}M`}</td></tr>`;
    });
    main = `<h1>Index of /archive/${title.toLowerCase().replace(/ /g, '-')}/</h1><table><tr><th>Name</th><th>Last modified</th><th>Size</th></tr>${rows.join('')}</table><hr><address>Apache/2.4.58 (Ubuntu) Server Port 443</address>`;
  } else {
    const from = 1 + n(400) * 7,
      rows = links
        .slice(0, 7)
        .map(
          (l, i) =>
            `<tr><td>${from + i}</td><td><a ${href(l.id)}>${l.label.replace(/^./, (c) => c.toUpperCase())} ${l.id.slice(0, 4)}</a></td><td>${STATUS[n(STATUS.length)]}</td><td>${date()}</td></tr>`,
        );
    main = `<h1>${title}</h1><p>Showing records ${from}-${from + 6} of ${(from + 900 + n(40000)).toLocaleString('en-US')}. Last synced ${date()}.</p><table><tr><th>ID</th><th>Record</th><th>Status</th><th>Updated</th></tr>${rows.join('')}</table><p><a ${href(links[7].id)}>Next page</a></p>${body.slice(0, body.indexOf('</p>') + 4)}`;
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>${title}</title></head><body>${main}</body></html>`;
}
/* ---------- formats: what a bot gets depends on what it asked for ---------- */
export type Fmt = 'html' | 'json' | 'text';
const BAIT = /^\/(\.env|\.git\/config$)/;
/** HTML when asked for; bait files (a fake .env or .git/config) for those paths; JSON for API clients and scripts that
 * accept anything; null (a 403) otherwise. Other honeypot paths always get HTML, as browsers and scanners expect. */
export function mazeFormat(path: string, accept: string): Fmt | null {
  if (BAIT.test(path)) return 'text';
  if (accept.includes('text/html') || (isTrap(path) && !path.startsWith(MAZE))) return 'html';
  if (!accept || accept.includes('json') || accept.includes('*/*')) return 'json';
  return null;
}
const SECRET_CHARS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** The document served for a path in a format. Every format carries the same 8 onward links (absolute URLs on the bot's
 * host outside HTML), so the admin map and inspector line up whatever the bot got. */
export function mazeDoc(path: string, fmt: Fmt, host: string) {
  if (fmt === 'html') return mazeHtml(path);
  const { title, links } = mazePage(path),
    q = rng(hash(path) ^ 0x85ebca6b),
    n = (k: number) => Math.floor(q() * k),
    word = () => WORDS[n(WORDS.length)],
    secret = (len: number) => Array.from({ length: len }, () => SECRET_CHARS[n(SECRET_CHARS.length)]).join(''),
    url = (id: string) => `https://${host}${MAZE}${id}`;
  if (fmt === 'json') {
    const from = 1 + n(400) * 7;
    return JSON.stringify({
      data: links.slice(0, 7).map((l, i) => ({
        id: from + i,
        name: `${l.label} ${l.id.slice(0, 4)}`,
        status: STATUS[n(STATUS.length)],
        updated_at: `${2016 + n(9)}-${String(1 + n(12)).padStart(2, '0')}-${String(1 + n(28)).padStart(2, '0')}T${String(n(24)).padStart(2, '0')}:${String(n(60)).padStart(2, '0')}:00Z`,
        url: url(l.id),
      })),
      meta: { collection: title.toLowerCase().replace(/ /g, '_'), page: Math.ceil(from / 7), per_page: 7, total: from + 900 + n(40000) },
      links: { next: url(links[7].id) },
    });
  }
  if (path.startsWith('/.git')) {
    const sub = links
      .slice(1)
      .map((l) => `[submodule "${l.label.replace(/ /g, '-')}"]\n\tpath = vendor/${l.label.replace(/ /g, '-')}\n\turl = ${url(l.id)}\n`)
      .join('');
    return `[core]
${['repositoryformatversion = 0', 'filemode = true', 'bare = false', 'logallrefupdates = true'].map((l) => `\t${l}\n`).join('')}[remote "origin"]\n\turl = ${url(links[0].id)}\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n[branch "main"]\n\tremote = origin\n\tmerge = refs/heads/main\n${sub}`;
  }
  const db = `${word()}_${word()}`;
  return [
    `APP_NAME="${title}"`,
    'APP_ENV=production',
    'APP_DEBUG=false',
    `APP_KEY=base64:${secret(43)}=`,
    `APP_URL=https://${host}`,
    '',
    'DB_CONNECTION=mysql',
    `DB_HOST=db-${links[0].id.slice(0, 4)}.internal`,
    'DB_PORT=3306',
    `DB_DATABASE=${db}`,
    `DB_USERNAME=${word()}_svc`,
    `DB_PASSWORD=${secret(20)}`,
    `REDIS_PASSWORD=${secret(24)}`,
    `JWT_SECRET=${secret(48)}`,
    '',
    `ADMIN_URL=${url(links[0].id)}`,
    `BACKUP_URL=${url(links[1].id)}`,
    `EXPORT_URL=${url(links[2].id)}`,
    `INTERNAL_API_URL=${url(links[3].id)}`,
    `STAGING_URL=${url(links[4].id)}`,
    `REPORTS_URL=${url(links[5].id)}`,
    `DOCS_URL=${url(links[6].id)}`,
    `DB_DUMP_URL=${url(links[7].id)}`,
    '',
  ].join('\n');
}
const TYPES: Record<Fmt, string> = { html: 'text/html; charset=utf-8', json: 'application/json', text: 'text/plain; charset=utf-8' };
/** What a document costs the bot: bytes downloaded and words to process. */
export function mazeCost(path: string, fmt: Fmt, host: string) {
  const doc = mazeDoc(path, fmt, host);
  // JSON and .env have few spaces, so count tokens there rather than space-separated words.
  return { bytes: new TextEncoder().encode(doc).length, words: (fmt === 'html' ? doc.replace(/<[^>]+>/g, ' ').match(/\S+/g) : doc.match(/\w+/g))?.length ?? 0 };
}

// ponytail: per-isolate request count per IP, so the delay grows for a bot that keeps coming (resets when the isolate does).
const streak = new Map<string, number>();
/** How long to hold this request: the page's own 1.5-3 s, stretched up to 4x as the IP keeps crawling (x2 at 50 requests). */
export function holdFor(ip: string, path: string) {
  const k = ipKey(ip),
    n = (streak.get(k) ?? 0) + 1;
  if (streak.size > 5000) streak.clear();
  streak.set(k, n);
  return Math.round(mazePage(path).delay * (1 + Math.min(3, n / 50)));
}
/** An endless document of plausible filler linking to more of the same. Slow on purpose: it costs us wall time, not CPU. */
export async function maze(path: string, fmt: Fmt, host: string, held: number): Promise<Response> {
  await new Promise((res) => setTimeout(res, held));
  return new Response(mazeDoc(path, fmt, host), {
    headers: { 'content-type': TYPES[fmt], 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' },
  });
}

/** The hidden link added to every page: invisible, out of the tab order and the accessibility tree. */
export const trapLink = (seed: string) => `<a href="${MAZE}${hash(seed).toString(16)}" hidden aria-hidden="true" tabindex="-1" rel="nofollow">archive</a>`;

/* ---------- activity ---------- */
export type BotEvent = {
  ip: string;
  host: string;
  method: string;
  path: string;
  kind: 'trap' | 'maze' | 'flagged';
  country: string;
  ua: string;
  fmt: Fmt | null;
  held: number;
};
const LOG_PER_DAY = 50;
/** One counter upsert per bot request (with what it cost the bot: bytes, words and time held when it got a document; a
 * 403 otherwise), plus a log row (with the format and hold, for the admin inspector) for the first LOG_PER_DAY requests of the IP each UTC day. */
export async function botEvent(env: Env, e: BotEvent) {
  const now = Date.now(),
    day = new Date(now).toISOString().slice(0, 10),
    ip = ipKey(e.ip),
    path = e.path.slice(0, 200),
    cost = e.fmt ? { ...mazeCost(e.path, e.fmt, e.host), held: e.held } : { bytes: 21, words: 0, held: 0 }; // 21: {"error":"Forbidden"}
  const r = await env.DB.prepare(
    `INSERT INTO bot_ips (ip, first_at, last_at, hits, traps, maze, day, day_hits, country, ua, first_path, last_path, last_host, bytes, words, held_ms)
     VALUES (?1, ?2, ?2, 1, ?3, ?4, ?5, 1, ?6, ?7, ?8, ?8, ?9, ?10, ?11, ?12)
     ON CONFLICT(ip) DO UPDATE SET last_at = ?2, hits = hits + 1, traps = traps + ?3, maze = maze + ?4,
       bytes = bytes + ?10, words = words + ?11, held_ms = held_ms + ?12,
       day_hits = CASE WHEN day = ?5 THEN day_hits + 1 ELSE 1 END, day = ?5, country = ?6, ua = ?7, last_path = ?8, last_host = ?9
     RETURNING day_hits`,
  )
    .bind(ip, now, e.kind === 'trap' ? 1 : 0, e.kind === 'maze' ? 1 : 0, day, e.country, e.ua.slice(0, 300), path, e.host, cost.bytes, cost.words, cost.held)
    .first<{ day_hits: number }>();
  if ((r?.day_hits ?? 0) <= LOG_PER_DAY)
    await env.DB.prepare('INSERT INTO bot_log (at, ip, host, method, path, kind, fmt, held_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(now, ip, e.host, e.method, path, e.kind, e.fmt, cost.held)
      .run();
}

/* ---------- crawler families ---------- */
const FAMILIES: [string, 'AI' | 'Search' | 'SEO' | 'Script' | 'Scanner', RegExp][] = [
  ['GPTBot', 'AI', /GPTBot/i],
  ['ChatGPT-User', 'AI', /ChatGPT-User/i],
  ['OAI-SearchBot', 'AI', /OAI-SearchBot/i],
  ['ClaudeBot', 'AI', /ClaudeBot|Claude-Web|anthropic-ai/i],
  ['Bytespider', 'AI', /Bytespider/i],
  ['CCBot', 'AI', /CCBot/i],
  ['PerplexityBot', 'AI', /Perplexity/i],
  ['Amazonbot', 'AI', /Amazonbot/i],
  ['Meta', 'AI', /meta-external|facebookexternalhit/i],
  ['Google-Extended', 'AI', /Google-Extended|GoogleOther/i],
  ['cohere', 'AI', /cohere-ai/i],
  ['Diffbot', 'AI', /Diffbot/i],
  ['Timpibot', 'AI', /Timpibot/i],
  ['Applebot', 'Search', /Applebot/i],
  ['Googlebot', 'Search', /Googlebot/i],
  ['Bingbot', 'Search', /bingbot/i],
  ['YandexBot', 'Search', /Yandex/i],
  ['Baiduspider', 'Search', /Baiduspider/i],
  ['PetalBot', 'Search', /PetalBot/i],
  ['AhrefsBot', 'SEO', /AhrefsBot/i],
  ['SemrushBot', 'SEO', /SemrushBot/i],
  ['DotBot', 'SEO', /DotBot/i],
  ['MJ12bot', 'SEO', /MJ12bot/i],
  ['DataForSeoBot', 'SEO', /DataForSeo/i],
  ['BLEXBot', 'SEO', /BLEXBot/i],
  ['zgrab', 'Scanner', /zgrab/i],
  ['Nuclei', 'Scanner', /Nuclei/i],
  ['masscan', 'Scanner', /masscan/i],
  ['Censys', 'Scanner', /Censys/i],
  ['Expanse', 'Scanner', /Expanse/i],
  ['Headless Chrome', 'Script', /HeadlessChrome/i],
  ['Scrapy', 'Script', /Scrapy/i],
  ['python', 'Script', /python|aiohttp|httpx/i],
  ['Go-http-client', 'Script', /Go-http-client/i],
  ['curl', 'Script', /^curl\//i],
  ['Wget', 'Script', /wget/i],
  ['Java', 'Script', /^Java\/|Apache-HttpClient|okhttp/i],
  ['Node.js', 'Script', /node-fetch|axios|undici|got \(/i],
];
/** Which crawler a user agent belongs to, and what kind it is. Unknown ones with a browser's UA are "Browser-like". */
export function crawlerFamily(ua: string | null | undefined): { name: string; type: string } {
  if (!ua) return { name: '(no user agent)', type: 'Script' };
  const f = FAMILIES.find(([, , re]) => re.test(ua));
  if (f) return { name: f[0], type: f[1] };
  return /^Mozilla\//.test(ua) ? { name: 'Browser-like', type: 'Other' } : { name: ua.split(/[\s/;(]/)[0].slice(0, 30) || 'Other', type: 'Other' };
}
