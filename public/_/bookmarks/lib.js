// Pure bookmark logic (no DOM): validation, dedupe, import/export, filtering. Tested from src/tools/bookmarks/lib.test.ts.

/** Normalises user input into an http(s) URL string, or returns null. Bare hostnames get https://. */
export function normalizeUrl(raw) {
  let s = String(raw ?? '').trim();
  if (!s) return null;
  // A scheme is letters then ':'; 'host:8080' (colon then digits) is a host with a port, not a scheme.
  if (!/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(s)) s = `https://${s.replace(/^\/\//, '')}`;
  try {
    const u = new URL(s);
    if ((u.protocol !== 'http:' && u.protocol !== 'https:') || !u.hostname || (!u.hostname.includes('.') && u.hostname !== 'localhost')) return null;
    return u.href;
  } catch {
    return null;
  }
}

/** Two URLs are duplicates when host (case, leading www.), path (trailing slash) and query match; scheme and #fragment are ignored. */
export function dupeKey(url) {
  try {
    const u = new URL(url);
    return `${u.hostname.toLowerCase().replace(/^www\./, '')}${u.port ? `:${u.port}` : ''}${u.pathname.replace(/\/+$/, '')}${u.search}`;
  } catch {
    return String(url);
  }
}

export function parseTags(s) {
  const out = [];
  for (const t of (Array.isArray(s) ? s : String(s ?? '').split(/[,\n]/)).map((x) =>
    String(x).trim().toLowerCase().replace(/\s+/g, '-').replace(/^#/, '').slice(0, 40),
  ))
    if (t && !out.includes(t)) out.push(t);
  return out.slice(0, 20);
}

export const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};
const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

/** Builds a clean bookmark or returns an error message. */
export function makeBookmark({ url, title, tags, added }, now = Date.now()) {
  const u = normalizeUrl(url);
  if (!u) return 'Enter a valid http:// or https:// URL';
  const t =
    String(title ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 300) || hostOf(u);
  const a = Number(added);
  return { id: newId(), url: u, title: t, tags: parseTags(tags), added: Number.isFinite(a) && a > 0 ? a : now };
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export const decodeEntities = (s) =>
  String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try {
        return String.fromCodePoint(n);
      } catch {
        return m;
      }
    }
    return ENT[e.toLowerCase()] ?? m;
  });
const attr = (tag, name) => {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return m ? decodeEntities(m[1] ?? m[2] ?? m[3]) : undefined;
};

/** ADD_DATE is seconds in browser exports; some tools write milliseconds or microseconds. Returns epoch ms. */
export const toMs = (n) => (!(n > 0) ? undefined : n > 1e14 ? Math.round(n / 1000) : n > 1e11 ? n : n * 1000);

/**
 * Parses the Netscape bookmark file format (exported by Chrome, Firefox, Safari, Edge). Folder names become tags,
 * together with any TAGS="a,b" attribute (Firefox, Pinboard). Returns raw items: { url, title, tags, added }.
 */
export function parseNetscape(html) {
  const items = [],
    folders = [];
  let pending = null; // folder name seen by <H3>, pushed when its <DL> opens
  const re = /<h3\b[^>]*>([\s\S]*?)<\/h3>|<a\b([^>]*)>([\s\S]*?)<\/a>|<dl\b[^>]*>|<\/dl>/gi;
  for (let m; (m = re.exec(html));) {
    const t = m[0].slice(0, 3).toLowerCase();
    if (m[1] !== undefined) pending = decodeEntities(m[1].replace(/<[^>]*>/g, '')).trim();
    else if (t === '<dl') {
      folders.push(pending);
      pending = null;
    } else if (t === '</d') folders.pop();
    else if (m[2] !== undefined) {
      const href = attr(m[2], 'href');
      if (!href) continue;
      const added = Number(attr(m[2], 'add_date'));
      const path = folders.filter((f) => f && !/^(bookmarks( bar| toolbar| menu)?|favorites bar|other bookmarks|mobile bookmarks)$/i.test(f));
      items.push({
        url: href,
        title: decodeEntities(m[3].replace(/<[^>]*>/g, '')).trim(),
        tags: [...path, ...parseTags(attr(m[2], 'tags'))],
        added: toMs(added),
      });
    }
  }
  return items;
}

/** Parses our JSON export (or a plain array, or { bookmarks: [...] }). Throws with a readable message on bad input. */
export function parseJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`Not valid JSON (${e.message})`, { cause: e });
  }
  const arr = Array.isArray(data) ? data : Array.isArray(data?.bookmarks) ? data.bookmarks : null;
  if (!arr) throw new Error('Expected a list of bookmarks, or an object with a "bookmarks" list');
  return arr
    .filter((x) => x && typeof x === 'object')
    .map((x) => ({
      url: x.url ?? x.href ?? x.uri,
      title: x.title ?? x.name ?? x.description,
      tags: x.tags ?? [],
      added: typeof x.added === 'string' ? Date.parse(x.added) : (x.added ?? x.time),
    }));
}

/** Detects the format by content and parses it. */
export function parseImport(text) {
  const s = String(text).trimStart();
  if (s.startsWith('[') || s.startsWith('{')) return parseJson(s);
  if (/<a\s[^>]*href/i.test(s)) return parseNetscape(s);
  throw new Error('Unrecognised file: use a JSON export or a browser bookmarks .html file');
}

/** Merges imported raw items into the list, skipping invalid URLs and duplicates (also within the import). */
export function mergeImport(list, raw, now = Date.now()) {
  const seen = new Set(list.map((b) => dupeKey(b.url)));
  const out = [...list];
  let added = 0,
    dupes = 0,
    invalid = 0;
  for (const r of raw) {
    const b = makeBookmark(r, now);
    if (typeof b === 'string') {
      invalid++;
      continue;
    }
    const k = dupeKey(b.url);
    if (seen.has(k)) {
      dupes++;
      continue;
    }
    seen.add(k);
    out.push(b);
    added++;
  }
  return { list: out, added, dupes, invalid };
}

export const findDupe = (list, url, exceptId) => {
  const k = dupeKey(normalizeUrl(url) ?? url);
  return list.find((b) => b.id !== exceptId && dupeKey(b.url) === k);
};

const SORTS = {
  newest: (a, b) => b.added - a.added,
  oldest: (a, b) => a.added - b.added,
  title: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true }),
  site: (a, b) => hostOf(a.url).localeCompare(hostOf(b.url)) || a.title.localeCompare(b.title),
};
/** Search matches every word against title, URL and tags; `tag` narrows to one tag. */
export function view(list, { q = '', tag = '', sort = 'newest' } = {}) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return list
    .filter((b) => (!tag || b.tags.includes(tag)) && words.every((w) => `${b.title}\n${b.url}\n${b.tags.join(' ')}`.toLowerCase().includes(w)))
    .sort(SORTS[sort] ?? SORTS.newest);
}
/** Tag -> count, most used first. */
export function tagCounts(list) {
  const m = new Map();
  for (const b of list) for (const t of b.tags) m.set(t, (m.get(t) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Netscape bookmark file that every browser can import. Tags go in TAGS="" (Firefox reads them). */
export function toNetscape(list) {
  const rows = list.map(
    (b) =>
      `    <DT><A HREF="${escHtml(b.url)}" ADD_DATE="${Math.floor(b.added / 1000)}"${b.tags.length ? ` TAGS="${escHtml(b.tags.join(','))}"` : ''}>${escHtml(b.title)}</A>`,
  );
  return [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- This is an automatically generated file. It will be read and overwritten. DO NOT EDIT! -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
    ...rows,
    '</DL><p>',
    '',
  ].join('\n');
}
export const toJson = (list) =>
  JSON.stringify(
    {
      format: '6o2f-bookmarks',
      version: 1,
      exported: new Date().toISOString(),
      bookmarks: list.map(({ url, title, tags, added }) => ({ url, title, tags, added: new Date(added).toISOString() })),
    },
    null,
    2,
  );
