// Pure Unicode inspection helpers (no DOM).
const CATS = { L: 'Letter', M: 'Mark', N: 'Number', P: 'Punctuation', S: 'Symbol', Z: 'Separator', C: 'Other' };
const SUB = [
  'Lu',
  'Ll',
  'Lt',
  'Lm',
  'Lo',
  'Mn',
  'Mc',
  'Me',
  'Nd',
  'Nl',
  'No',
  'Pc',
  'Pd',
  'Ps',
  'Pe',
  'Pi',
  'Pf',
  'Po',
  'Sm',
  'Sc',
  'Sk',
  'So',
  'Zs',
  'Zl',
  'Zp',
  'Cc',
  'Cf',
  'Cs',
  'Co',
  'Cn',
].map((c) => [c, new RegExp(`^\\p{${c}}$`, 'u')]);

/** "Letter (Lu)", "Control (Cc)", ... for one code point. */
export function category(cp) {
  const ch = String.fromCodePoint(cp),
    hit = SUB.find(([, re]) => re.test(ch));
  const c = hit?.[0] ?? 'Cn';
  return `${c === 'Cc' ? 'Control' : c === 'Cf' ? 'Format' : CATS[c[0]]} (${c})`;
}

const NAMES = {
  0x200b: 'ZWSP',
  0x200c: 'ZWNJ',
  0x200d: 'ZWJ',
  0x2060: 'WJ',
  0xfeff: 'BOM',
  0x200e: 'LRM',
  0x200f: 'RLM',
  0x202a: 'LRE',
  0x202b: 'RLE',
  0x202c: 'PDF',
  0x202d: 'LRO',
  0x202e: 'RLO',
  0x2066: 'LRI',
  0x2067: 'RLI',
  0x2068: 'FSI',
  0x2069: 'PDI',
  0xa0: 'NBSP',
  0x202f: 'NNBSP',
  0xad: 'SHY',
  0x180e: 'MVS',
  0x3000: 'IDSP',
  0x34f: 'CGJ',
};
const LABEL = {
  0x200b: 'zero-width space',
  0x200c: 'zero-width non-joiner',
  0x200d: 'zero-width joiner',
  0x2060: 'word joiner',
  0xfeff: 'BOM / zero-width no-break space',
  0xa0: 'non-breaking space',
  0x202f: 'narrow no-break space',
  0xad: 'soft hyphen',
  0x34f: 'combining grapheme joiner',
};
const isBidi = (cp) => (cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069) || cp === 0x200e || cp === 0x200f || cp === 0x61c;
const isSpaceLike = (cp) => cp !== 0x20 && /^\p{Zs}$/u.test(String.fromCodePoint(cp));
// Cyrillic/Greek letters that look like Latin ones.
const LOOKALIKE = /[аеорсухіјѕԁԛѵАВЕКМНОРСТХІЈЅΑΒΕΖΗΙΚΜΝΟΡΤΥΧοναρυιτκχ]/u;

/** Flags for one grapheme (string of >= 1 code points). `word` = the surrounding word, for mixed-script detection. */
export function flags(g, word = g) {
  const out = [],
    cps = [...g].map((c) => c.codePointAt(0)),
    emoji = cps.length > 1 && /\p{Extended_Pictographic}/u.test(g);
  for (const cp of cps) {
    if ((cp === 0x200d || cp === 0xfe0f) && emoji) continue; // legitimate inside an emoji sequence
    if (isBidi(cp)) out.push(cp === 0x202e || cp === 0x202d || cp === 0x2067 ? 'bidi override: can reorder text' : 'bidi control');
    else if (LABEL[cp]) out.push(LABEL[cp]);
    else if (isSpaceLike(cp)) out.push('unusual space');
    else if (/^\p{Cc}$/u.test(String.fromCodePoint(cp)) && cp !== 9 && cp !== 10 && cp !== 13) out.push('control character');
    else if (/^\p{Cf}$/u.test(String.fromCodePoint(cp))) out.push('invisible format character');
    else if (/^\p{Co}$|^\p{Cn}$/u.test(String.fromCodePoint(cp))) out.push('private or unassigned');
  }
  if (LOOKALIKE.test(g) && /\p{Script=Latin}/u.test(word)) out.push('Cyrillic/Greek lookalike in a Latin word');
  return [...new Set(out)];
}

/** Placeholder shown for characters you cannot see. */
export function display(g) {
  const cp = g.codePointAt(0);
  if (g.length === (cp > 0xffff ? 2 : 1)) {
    if (NAMES[cp]) return NAMES[cp];
    if (cp < 0x20 || cp === 0x7f) return cp === 0x7f ? 'DEL' : String.fromCodePoint(0x2400 + cp);
    if (/^[\p{Zs}\p{Cf}]$/u.test(g)) return '·';
  }
  return g;
}

export const graphemes = (t) => [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(t)].map((s) => s.segment);
export const hex = (n, pad = 4) => n.toString(16).toUpperCase().padStart(pad, '0');
export const utf8 = (g) => [...new TextEncoder().encode(g)].map((b) => hex(b, 2)).join(' ');
export const utf16 = (g) =>
  [...g]
    .flatMap((c) => (c.length === 2 ? [c.charCodeAt(0), c.charCodeAt(1)] : [c.charCodeAt(0)]))
    .map((u) => hex(u))
    .join(' ');

/** One row per grapheme. Words (runs without whitespace) drive the mixed-script check. */
export function analyze(text) {
  const gs = graphemes(text),
    rows = [];
  let i = 0;
  while (i < gs.length) {
    let j = i;
    while (j < gs.length && !/^\s/u.test(gs[j])) j++;
    const word = gs.slice(i, j).join('');
    for (let k = i; k < Math.max(j, i + 1); k++) rows.push(row(gs[k], word));
    i = Math.max(j, i + 1);
  }
  return rows;
}
function row(g, word) {
  const cps = [...g].map((c) => c.codePointAt(0));
  return {
    g,
    shown: display(g),
    cps,
    cp: cps.map((c) => 'U+' + hex(c)).join(' '),
    utf8: utf8(g),
    utf16: utf16(g),
    cat: [...new Set(cps.map(category))].join(', '),
    flags: flags(g, word),
  };
}

/** What the find box means: U+1F600, 0x1F600, bare hex of 4+ digits (code point), otherwise the pasted characters. Returns code points or null. */
export function parseFind(q) {
  q = q.trim();
  if (!q) return null;
  const m = /^(?:u\+|0x)([0-9a-f]{1,6})$/i.exec(q) ?? /^([0-9a-f]{4,6})$/i.exec(q);
  if (m) {
    const n = parseInt(m[1], 16);
    return n <= 0x10ffff ? [n] : null;
  }
  return [...q].map((c) => c.codePointAt(0));
}

export const NORMS = ['NFC', 'NFD', 'NFKC', 'NFKD'];

/** Remove invisible and bidi control characters (keeping ZWJ / VS16 inside emoji) and turn unusual spaces into plain spaces. */
export function clean(text) {
  return graphemes(text)
    .map((g) => {
      const emoji = /\p{Extended_Pictographic}/u.test(g);
      return [...g]
        .map((c) => {
          const cp = c.codePointAt(0);
          if (emoji && (cp === 0x200d || cp === 0xfe0f)) return c;
          if (isSpaceLike(cp)) return ' ';
          if (isBidi(cp) || /^\p{Cf}$/u.test(c) || (/^\p{Cc}$/u.test(c) && cp !== 9 && cp !== 10 && cp !== 13)) return '';
          return c;
        })
        .join('');
    })
    .join('');
}
