// Tolerant RSS 2.0 / RSS 1.0 (RDF) / Atom parser. Regex based on purpose: Workers have no DOM, and feeds in the wild are often not well-formed.
export type Item = { title: string; link: string | null; date: string | null; snippet: string };
export type Feed = { title: string; items: Item[] };

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  copy: '©',
};
export const decode = (s: string) =>
  s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (m, d, h, n) => {
    if (n) return NAMED[n.toLowerCase()] ?? m;
    const cp = d ? +d : parseInt(h, 16);
    return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
  });
const strip = (s: string) => s.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '').replace(/<[^>]*>/g, ' ');
const squash = (s: string) => s.replace(/\s+/g, ' ').trim();
const CDATA = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/;
/** Element text with CDATA unwrapped (else entity-decoded once); `html` says whether the result may still contain markup. */
const unwrap = (raw: string) => {
  const m = CDATA.exec(raw);
  return m ? { s: m[1], html: true } : { s: decode(raw), html: false };
};

const re = (name: string) => `<${name.replace(':', '\\:')}(?:\\s[^>]*)?(?:/>|>([\\s\\S]*?)</${name.replace(':', '\\:')}>)`;
const text = (xml: string, ...names: string[]) => {
  for (const n of names) {
    const m = new RegExp(re(n), 'i').exec(xml);
    if (m?.[1] !== undefined && m[1].trim()) return m[1];
  }
};
const attr = (tag: string, name: string) => {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag);
  return m ? decode(m[1] ?? m[2]) : undefined;
};

const httpUrl = (s: string | undefined, base?: string) => {
  try {
    const u = new URL(s?.trim() ?? '', base);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
};

function link(entry: string, base?: string) {
  const tags = entry.match(/<link\b[^>]*?(?:\/>|>)/gi) ?? [];
  const alt = tags.find((t) => !attr(t, 'rel') || attr(t, 'rel') === 'alternate') ?? tags.find((t) => attr(t, 'href'));
  const href = alt && attr(alt, 'href'); // Atom
  if (href) return httpUrl(href, base);
  const t = text(entry, 'link'); // RSS
  const guid = text(entry, 'guid');
  return httpUrl(t && unwrap(t).s, base) ?? httpUrl(guid && unwrap(guid).s, base);
}

const plain = (raw: string | undefined) => {
  if (raw === undefined) return '';
  const u = unwrap(raw);
  return squash(u.html ? decode(strip(u.s)) : u.s);
};
const snippet = (raw: string | undefined) => {
  if (raw === undefined) return '';
  const t = squash(decode(strip(unwrap(raw).s)));
  return t.length > 200 ? `${t.slice(0, 199)}…` : t;
};
const date = (s: string | undefined) => {
  const t = s ? Date.parse(unwrap(s).s.trim()) : NaN;
  return Number.isNaN(t) ? null : new Date(t).toISOString();
};

/** Returns null when the text is not a feed at all. At most 50 items. */
export function parseFeed(xml: string, baseUrl?: string): Feed | null {
  if (!/<(rss|feed|rdf:RDF)\b/i.test(xml)) return null;
  const entries = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) ?? [];
  const head = xml.replace(/<(item|entry)\b[\s\S]*?<\/\1>/gi, '');
  return {
    title: plain(text(head, 'title')),
    items: entries.slice(0, 50).map((e) => ({
      title: plain(text(e, 'title')) || '(untitled)',
      link: link(e, baseUrl),
      date: date(text(e, 'pubDate', 'published', 'updated', 'dc:date')),
      snippet: snippet(text(e, 'description', 'summary', 'content:encoded', 'content')),
    })),
  };
}
