// Pure HTML entity helpers: used by app.js and tested in src/tools/html/lib.test.ts.
const SPECIAL = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape the five specials; nonAscii also turns every non-ASCII code point into &#N; */
export const escape = (s, nonAscii) => {
  s = s.replace(/[&<>"']/g, (c) => SPECIAL[c]);
  return nonAscii ? s.replace(/[^\x00-\x7f]/gu, (c) => `&#${c.codePointAt(0)};`) : s;
};

// ponytail: small named table for non-browser use; the browser path below decodes every named entity.
const NAMED = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  copy: '©',
  reg: '®',
  trade: '™',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  euro: '€',
  pound: '£',
  yen: '¥',
  cent: '¢',
  sect: '§',
  deg: '°',
  plusmn: '±',
  times: '×',
  divide: '÷',
  laquo: '«',
  raquo: '»',
  bull: '•',
  middot: '·',
  eacute: 'é',
  egrave: 'è',
  agrave: 'à',
  uuml: 'ü',
  ouml: 'ö',
  auml: 'ä',
  szlig: 'ß',
  ntilde: 'ñ',
  ccedil: 'ç',
};
const cp = (n) => (n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '�');

/** Decode numeric (decimal/hex) and common named entities with a regex; pure string work. */
export const unescapeBasic = (s) =>
  s.replace(/&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([a-zA-Z][a-zA-Z0-9]*));/g, (m, d, h, n) => (d ? cp(+d) : h ? cp(parseInt(h, 16)) : (NAMED[n] ?? m)));

/** Full named-entity decoding via a detached <textarea>: its content is RCDATA, so markup stays text and nothing runs or is inserted. */
export const unescape = (s) => {
  if (typeof document === 'undefined') return unescapeBasic(s);
  const t = document.createElement('textarea');
  t.innerHTML = s;
  return t.value;
};
