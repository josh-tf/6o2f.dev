// String escaping for many languages, both directions. Pure functions, no DOM.
// escape(lang, s, { ascii }) → string; unescape(lang, s) → { text, warnings } and throws Error with a readable message.

const hex = (n, w) => n.toString(16).toUpperCase().padStart(w, '0');
const utf8 = (s) => new TextEncoder().encode(s);
const isCtl = (c) => c < 0x20 || c === 0x7f;
/** Split a code point into UTF-16 \uXXXX escapes (surrogate pair above U+FFFF). */
const u16 = (cp) => (cp > 0xffff ? [0xd800 + ((cp - 0x10000) >> 10), 0xdc00 + ((cp - 0x10000) & 0x3ff)] : [cp]).map((u) => `\\u${hex(u, 4)}`).join('');

function mapChars(s, fn) {
  let o = '';
  for (const ch of s) o += fn(ch, ch.codePointAt(0));
  return o;
}

const JS_SHORT = { '\\': '\\\\', '"': '\\"', "'": "\\'", '\n': '\\n', '\r': '\\r', '\t': '\\t', '\b': '\\b', '\f': '\\f', '\v': '\\v' };

const ESC = {
  json: (s, o) =>
    mapChars(
      s,
      (ch, c) =>
        ({ '\\': '\\\\', '"': '\\"', '\n': '\\n', '\r': '\\r', '\t': '\\t', '\b': '\\b', '\f': '\\f' })[ch] ??
        (c < 0x20 || (c >= 0xd800 && c <= 0xdfff) || c === 0x2028 || c === 0x2029 || (o.ascii && c > 0x7e) ? u16(c) : ch),
    ),
  js: (s, o) =>
    mapChars(
      s,
      (ch, c) =>
        JS_SHORT[ch] ??
        (isCtl(c)
          ? `\\x${hex(c, 2)}`
          : c === 0x2028 || c === 0x2029 || (c >= 0xd800 && c <= 0xdfff)
            ? u16(c)
            : o.ascii && c > 0x7e
              ? c > 0xffff
                ? `\\u{${hex(c, 0)}}`
                : u16(c)
              : ch),
    ),
  python: (s, o) =>
    mapChars(
      s,
      (ch, c) =>
        ({ '\\': '\\\\', '"': '\\"', "'": "\\'", '\n': '\\n', '\r': '\\r', '\t': '\\t' })[ch] ??
        (isCtl(c)
          ? `\\x${hex(c, 2).toLowerCase()}`
          : o.ascii && c > 0x7e
            ? c <= 0xff
              ? `\\x${hex(c, 2).toLowerCase()}`
              : c <= 0xffff
                ? `\\u${hex(c, 4).toLowerCase()}`
                : `\\U${hex(c, 8).toLowerCase()}`
            : ch),
    ),
  // Octal, not \x: a C hex escape swallows every following hex digit ("\x41BC" is one char), octal stops at three.
  c: (s, o) =>
    mapChars(
      s,
      (ch, c) =>
        ({ '\\': '\\\\', '"': '\\"', "'": "\\'", '\n': '\\n', '\r': '\\r', '\t': '\\t', '\b': '\\b', '\f': '\\f', '\v': '\\v', '\x07': '\\a' })[ch] ??
        (isCtl(c) ? `\\${c.toString(8).padStart(3, '0')}` : o.ascii && c > 0x7e ? [...utf8(ch)].map((b) => `\\${b.toString(8)}`).join('') : ch),
    ),
  java: (s, o) =>
    mapChars(
      s,
      (ch, c) =>
        ({ '\\': '\\\\', '"': '\\"', "'": "\\'", '\n': '\\n', '\r': '\\r', '\t': '\\t', '\b': '\\b', '\f': '\\f' })[ch] ??
        (isCtl(c) || (o.ascii && c > 0x7e) || (c >= 0xd800 && c <= 0xdfff) ? u16(c) : ch),
    ),
  sql: (s) => s.replace(/'/g, "''"),
  shsingle: (s) => `'${s.replace(/'/g, `'\\''`)}'`,
  shdouble: (s) => `"${s.replace(/[\\"$`]/g, '\\$&')}"`,
  // "-" becomes \x2d, not \-: \- is a syntax error outside a class in JavaScript's u and v modes.
  regex: (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&').replace(/-/g, '\\x2d'),
  csv: (s) => (/[",\r\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s),
  html: (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]),
  url: (s) => {
    try {
      return encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${hex(c.charCodeAt(0), 2)}`);
    } catch {
      throw new Error('The text contains a lone UTF-16 surrogate, which has no UTF-8 encoding.');
    }
  },
};

export const LANGS = [
  ['json', 'JSON string'],
  ['js', 'JavaScript'],
  ['python', 'Python'],
  ['c', 'C / C++'],
  ['java', 'Java'],
  ['sql', "SQL '…'"],
  ['shsingle', "Shell '…'"],
  ['shdouble', 'Shell "…"'],
  ['regex', 'Regex literal'],
  ['csv', 'CSV field'],
  ['html', 'HTML attribute'],
  ['url', 'URL component'],
];

export function escape(lang, s, opts = {}) {
  const f = ESC[lang];
  if (!f) throw new Error(`Unknown language ${lang}`);
  return f(s, opts);
}

// ---------- unescape ----------
function fail(msg, i) {
  throw new Error(i == null ? msg : `${msg} (at character ${i + 1})`);
}
const cp = (n, i) => {
  if (n > 0x10ffff) fail(`Code point ${hex(n, 0)} is above U+10FFFF`, i);
  return String.fromCodePoint(n);
};
/** Strip one pair of matching outer quotes when the whole input is a quoted literal. */
function unquote(s, quotes) {
  const q = s[0];
  if (s.length >= 2 && quotes.includes(q) && s.at(-1) === q) {
    const inner = s.slice(1, -1);
    let open = false; // an unescaped quote of the same kind inside means it isn't a single literal
    for (let i = 0; i < inner.length; i++) {
      if (inner[i] === '\\') i++;
      else if (inner[i] === q) open = true;
    }
    if (!open) return inner;
  }
  return s;
}

/** Generic backslash-escape walker. `table` maps the char after \ to a replacement; `special(s, i)` handles the rest and returns [text, nextIndex] or null. */
function walk(s, table, special, unknown) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '\\') {
      out += s[i];
      continue;
    }
    if (i + 1 >= s.length) fail('The text ends with a lone backslash', i);
    const n = s[i + 1];
    if (n in table) {
      out += table[n];
      i++;
      continue;
    }
    if (n === '\n' || n === '\r') {
      i += n === '\r' && s[i + 2] === '\n' ? 2 : 1;
      continue;
    } // line continuation
    const r = special(s, i);
    if (r) {
      out += r[0];
      i = r[1] - 1;
      continue;
    }
    out += unknown(n, i);
    i++;
  }
  return out;
}
const hexAt = (s, i, n, what) => {
  const h = s.slice(i, i + n);
  if (!new RegExp(`^[0-9a-fA-F]{${n}}$`).test(h)) fail(`${what} needs ${n} hex digits, got "${h}"`, i);
  return parseInt(h, 16);
};
const octal = (s, i, max = 3) => {
  const m = new RegExp(`^[0-7]{1,${max}}`).exec(s.slice(i));
  return m ? [parseInt(m[0], 8), i + m[0].length] : null;
};

const UN = {
  json(s) {
    s = unquote(s, '"');
    try {
      return JSON.parse(`"${s.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')}"`);
    } catch (e) {
      const m = /position (\d+)/.exec(e.message);
      fail(`Not a valid JSON string body: ${e.message.replace(/ in JSON.*$/, '')}`, m ? Math.max(0, +m[1] - 1) : null);
    }
  },
  js(s) {
    s = unquote(s, `'"\``);
    return walk(
      s,
      { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '\\': '\\', "'": "'", '"': '"', '`': '`', $: '$' },
      (s, i) => {
        const n = s[i + 1];
        if (n === 'x') return [String.fromCharCode(hexAt(s, i + 2, 2, '\\x')), i + 4];
        if (n === 'u' && s[i + 2] === '{') {
          const end = s.indexOf('}', i + 3),
            h = s.slice(i + 3, end);
          if (end < 0 || !/^[0-9a-fA-F]{1,6}$/.test(h)) fail('\\u{…} needs 1 to 6 hex digits and a closing }', i);
          return [cp(parseInt(h, 16), i), end + 1];
        }
        if (n === 'u') return [String.fromCharCode(hexAt(s, i + 2, 4, '\\u')), i + 6];
        if (n === '0' && !/[0-9]/.test(s[i + 2] || '')) return ['\0', i + 2];
        if (/[0-7]/.test(n)) {
          const [v, j] = octal(s, i + 1, n <= '3' ? 3 : 2);
          return [String.fromCharCode(v), j];
        } // legacy octal (sloppy mode)
        return null;
      },
      (n) => n,
    ); // JS: \q → q
  },
  python(s) {
    s = unquote(s, `'"`);
    return walk(
      s,
      { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', a: '\x07', '\\': '\\', "'": "'", '"': '"' },
      (s, i) => {
        const n = s[i + 1];
        if (n === 'x') return [String.fromCharCode(hexAt(s, i + 2, 2, '\\x')), i + 4];
        if (n === 'u') return [String.fromCharCode(hexAt(s, i + 2, 4, '\\u')), i + 6];
        if (n === 'U') return [cp(hexAt(s, i + 2, 8, '\\U'), i), i + 10];
        if (n === 'N') fail('\\N{name} named characters are not supported here; use \\u or \\U', i);
        if (/[0-7]/.test(n)) {
          const [v, j] = octal(s, i + 1);
          return [String.fromCharCode(v), j];
        }
        return null;
      },
      (n) => '\\' + n,
    ); // Python keeps unknown escapes as written
  },
  c(s) {
    s = unquote(s, `"'`);
    // C escapes produce bytes; assemble bytes and decode as UTF-8 at the end.
    const bytes = [];
    const push = (str) => bytes.push(...utf8(str));
    for (let i = 0; i < s.length; i++) {
      if (s[i] !== '\\') {
        const c = s.codePointAt(i);
        push(String.fromCodePoint(c));
        if (c > 0xffff) i++;
        continue;
      }
      const n = s[i + 1];
      if (n === undefined) fail('The text ends with a lone backslash', i);
      const simple = { n: 10, r: 13, t: 9, b: 8, f: 12, v: 11, a: 7, '\\': 92, "'": 39, '"': 34, '?': 63, e: 27 }[n];
      if (simple !== undefined) {
        bytes.push(simple);
        i++;
        continue;
      }
      if (n === '\n') {
        i++;
        continue;
      }
      if (n === 'x') {
        const m = /^[0-9a-fA-F]+/.exec(s.slice(i + 2));
        if (!m) fail('\\x needs at least one hex digit', i);
        const v = parseInt(m[0], 16);
        if (v > 0xff) fail(`\\x${m[0]} is out of range for a char (C hex escapes take every following hex digit; split the string to stop one)`, i);
        bytes.push(v);
        i += 1 + m[0].length;
        continue;
      }
      if (n === 'u' || n === 'U') {
        const w = n === 'u' ? 4 : 8;
        push(cp(hexAt(s, i + 2, w, `\\${n}`), i));
        i += 1 + w;
        continue;
      }
      const o = octal(s, i + 1);
      if (o) {
        if (o[0] > 0xff) fail('Octal escape above \\377', i);
        bytes.push(o[0]);
        i = o[1] - 1;
        continue;
      }
      fail(`\\${n} is not a C escape sequence`, i);
    }
    const out = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
    return out;
  },
  java(s) {
    s = unquote(s, `"'`);
    return walk(
      s,
      { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', s: ' ', '\\': '\\', "'": "'", '"': '"' },
      (s, i) => {
        const n = s[i + 1];
        if (n === 'u') {
          let j = i + 1;
          while (s[j] === 'u') j++;
          return [String.fromCharCode(hexAt(s, j, 4, '\\u')), j + 4];
        }
        if (/[0-7]/.test(n)) {
          const [v, j] = octal(s, i + 1, n <= '3' ? 3 : 2);
          return [String.fromCharCode(v), j];
        }
        return null;
      },
      (n, i) => fail(`\\${n} is not a Java escape sequence`, i),
    );
  },
  sql(s) {
    if (/^'(?:[^']|'')*'$/.test(s) && s.length >= 2) s = s.slice(1, -1);
    const lone = s.replace(/''/g, '\0\0').indexOf("'");
    if (lone >= 0) fail("A single quote must be doubled ('') inside a SQL string", lone);
    return s.replace(/''/g, "'");
  },
  shsingle: (s) => shellWord(s),
  shdouble: (s) => shellWord(s),
  regex(s) {
    if (/^\/.*\/[a-z]*$/s.test(s) && s.length > 1) s = s.slice(1, s.lastIndexOf('/'));
    return walk(
      s,
      { n: '\n', r: '\r', t: '\t', f: '\f', v: '\v', 0: '\0' },
      (s, i) => {
        const n = s[i + 1];
        if (n === 'x') return [String.fromCharCode(hexAt(s, i + 2, 2, '\\x')), i + 4];
        if (n === 'u' && s[i + 2] === '{') {
          const end = s.indexOf('}', i + 3),
            h = s.slice(i + 3, end);
          if (end < 0 || !/^[0-9a-fA-F]{1,6}$/.test(h)) fail('\\u{…} needs 1 to 6 hex digits and a closing }', i);
          return [cp(parseInt(h, 16), i), end + 1];
        }
        if (n === 'u') return [String.fromCharCode(hexAt(s, i + 2, 4, '\\u')), i + 6];
        if (/[dDwWsSbB]/.test(n)) fail(`\\${n} is a character class or assertion, not a literal character`, i);
        if (/[1-9]/.test(n)) fail(`\\${n} is a back-reference, not a literal character`, i);
        return null;
      },
      (n) => n,
    );
  },
  csv(s) {
    if (!s.startsWith('"')) {
      if (s.includes('"')) fail('A field containing " must be wrapped in quotes with inner quotes doubled', s.indexOf('"'));
      return s;
    }
    let out = '';
    for (let i = 1; i < s.length; i++) {
      if (s[i] !== '"') {
        out += s[i];
        continue;
      }
      if (s[i + 1] === '"') {
        out += '"';
        i++;
        continue;
      }
      if (i !== s.length - 1) fail('Unexpected text after the closing quote', i + 1);
      return out;
    }
    fail('The quoted field is not closed');
  },
  html: (s) => decodeEntities(s),
  url(s) {
    try {
      return decodeURIComponent(s.replace(/\+/g, '%20'));
    } catch {
      const m = /%(?![0-9a-fA-F]{2})/.exec(s);
      fail(m ? 'A % must be followed by two hex digits' : 'The %-escapes do not form valid UTF-8', m ? m.index : null);
    }
  },
};

/** Parse a POSIX shell word: '…', "…", $'…' and unquoted backslashes. Variables are not expanded. */
export function shellWord(s) {
  let out = '',
    warn = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "'") {
      const end = s.indexOf("'", i + 1);
      if (end < 0) fail('Unclosed single quote', i);
      out += s.slice(i + 1, end);
      i = end;
    } else if (ch === '$' && s[i + 1] === "'") {
      let j = i + 2;
      while (j < s.length && s[j] !== "'") j += s[j] === '\\' ? 2 : 1;
      if (j >= s.length) fail("Unclosed $'…' quote", i);
      out += UN.c(s.slice(i + 2, j).replace(/"/g, '\\"'));
      i = j;
    } else if (ch === '"') {
      let j = i + 1;
      for (; j < s.length && s[j] !== '"'; j++) {
        if (s[j] === '\\' && '\\"$`\n'.includes(s[j + 1])) {
          if (s[j + 1] !== '\n') out += s[j + 1];
          j++;
        } else {
          if ((s[j] === '$' && /[\w{(]/.test(s[j + 1] || '')) || s[j] === '`')
            warn.push(`${s[j]}… at character ${j + 1} would be expanded by the shell; shown as written.`);
          out += s[j];
        }
      }
      if (j >= s.length) fail('Unclosed double quote', i);
      i = j;
    } else if (ch === '\\') {
      if (i + 1 >= s.length) fail('The text ends with a lone backslash', i);
      if (s[i + 1] !== '\n') out += s[i + 1];
      i++;
    } else {
      if (ch === '$' && /[\w{(]/.test(s[i + 1] || '')) warn.push(`$… at character ${i + 1} would be expanded by the shell; shown as written.`);
      out += ch;
    }
  }
  return { text: out, warnings: warn };
}

// Common named entities; numeric references (&#…; &#x…;) cover the rest.
// ponytail: ~110 of the 2,231 HTML5 names; add more here if a real page needs them.
const ENT = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
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
  sbquo: '‚',
  bdquo: '„',
  laquo: '«',
  raquo: '»',
  lsaquo: '‹',
  rsaquo: '›',
  bull: '•',
  middot: '·',
  deg: '°',
  plusmn: '±',
  times: '×',
  divide: '÷',
  minus: '−',
  euro: '€',
  pound: '£',
  yen: '¥',
  cent: '¢',
  curren: '¤',
  sect: '§',
  para: '¶',
  dagger: '†',
  Dagger: '‡',
  permil: '‰',
  prime: '′',
  Prime: '″',
  larr: '←',
  rarr: '→',
  uarr: '↑',
  darr: '↓',
  harr: '↔',
  lArr: '⇐',
  rArr: '⇒',
  hArr: '⇔',
  le: '≤',
  ge: '≥',
  ne: '≠',
  asymp: '≈',
  equiv: '≡',
  infin: '∞',
  sum: '∑',
  prod: '∏',
  radic: '√',
  part: '∂',
  int: '∫',
  forall: '∀',
  exist: '∃',
  isin: '∈',
  empty: '∅',
  and: '∧',
  or: '∨',
  cap: '∩',
  cup: '∪',
  sub: '⊂',
  sup: '⊃',
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  theta: 'θ',
  lambda: 'λ',
  mu: 'μ',
  pi: 'π',
  sigma: 'σ',
  tau: 'τ',
  phi: 'φ',
  omega: 'ω',
  Delta: 'Δ',
  Omega: 'Ω',
  Sigma: 'Σ',
  Pi: 'Π',
  iexcl: '¡',
  iquest: '¿',
  ordf: 'ª',
  ordm: 'º',
  sup1: '¹',
  sup2: '²',
  sup3: '³',
  frac14: '¼',
  frac12: '½',
  frac34: '¾',
  micro: 'µ',
  shy: '\u00ad',
  zwj: '\u200d',
  zwnj: '\u200c',
  thinsp: '\u2009',
  ensp: '\u2002',
  emsp: '\u2003',
  hearts: '♥',
  spades: '♠',
  clubs: '♣',
  diams: '♦',
  check: '✓',
  star: '☆',
  starf: '★',
  aacute: 'á',
  eacute: 'é',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
  agrave: 'à',
  egrave: 'è',
  ograve: 'ò',
  auml: 'ä',
  euml: 'ë',
  ouml: 'ö',
  uuml: 'ü',
  Auml: 'Ä',
  Ouml: 'Ö',
  Uuml: 'Ü',
  szlig: 'ß',
  ccedil: 'ç',
  ntilde: 'ñ',
  Ntilde: 'Ñ',
  aring: 'å',
  Aring: 'Å',
  aelig: 'æ',
  oslash: 'ø',
  Eacute: 'É',
  tab: '\t',
  newline: '\n',
  colon: ':',
  comma: ',',
  period: '.',
  excl: '!',
  quest: '?',
  num: '#',
  dollar: '$',
  percnt: '%',
  lpar: '(',
  rpar: ')',
  ast: '*',
  plus: '+',
  sol: '/',
  bsol: '\\',
  semi: ';',
  equals: '=',
  commat: '@',
  lsqb: '[',
  rsqb: ']',
  lowbar: '_',
  grave: '`',
  lcub: '{',
  rcub: '}',
  verbar: '|',
  tilde: '˜',
};
// HTML maps &#128;–&#159; to Windows-1252 characters, as browsers do.
const W1252 = {
  128: 8364,
  130: 8218,
  131: 402,
  132: 8222,
  133: 8230,
  134: 8224,
  135: 8225,
  136: 710,
  137: 8240,
  138: 352,
  139: 8249,
  140: 338,
  142: 381,
  145: 8216,
  146: 8217,
  147: 8220,
  148: 8221,
  149: 8226,
  150: 8211,
  151: 8212,
  152: 732,
  153: 8482,
  154: 353,
  155: 8250,
  156: 339,
  158: 382,
  159: 376,
};
export function decodeEntities(s) {
  const warnings = [];
  const text = s.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]*);?/g, (m, body, off) => {
    if (body[0] === '#') {
      let n = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      n = W1252[n] ?? n;
      return n === 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff) ? '\ufffd' : String.fromCodePoint(n);
    }
    if (body in ENT) return ENT[body];
    if (m.endsWith(';')) warnings.push(`&${body}; is not in this tool's entity list; left as written (at character ${off + 1}).`);
    return m;
  });
  return { text, warnings };
}

export function unescape(lang, s) {
  const f = UN[lang];
  if (!f) throw new Error(`Unknown language ${lang}`);
  const r = f(s);
  return typeof r === 'string' ? { text: r, warnings: [] } : r;
}
