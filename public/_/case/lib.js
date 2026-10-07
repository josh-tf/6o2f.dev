// Pure case helpers: used by app.js and tested in src/tools/case/lib.test.ts.
// Word = Acronym (before a Capitalised word), Capitalised/lower word, ACRONYM, number or caseless letters (CJK...).
const WORD = /\p{Lu}+(?=\p{Lu}\p{Ll})|\p{Lu}?[\p{Ll}\p{M}]+|\p{Lu}+|\p{N}+|\p{Lo}[\p{Lo}\p{M}]*/gu;

/** Split on case boundaries, digits, acronyms and punctuation: "HTTPServer v2-beta" -> HTTP Server v 2 beta. Apostrophes inside a word are dropped. */
export const words = (s) => s.replace(/(\p{L})['’](?=\p{L})/gu, '$1').match(WORD) ?? [];

const cap = (w) => w.replace(/^./u, (c) => c.toUpperCase());
const join = (sep, f) => (s) => words(s).map(f).join(sep);
const lower = (s) => s.toLowerCase();

export const CASES = [
  ['lower', 'lowercase', lower],
  ['upper', 'UPPERCASE', (s) => s.toUpperCase()],
  ['title', 'Title Case', (s) => lower(s).replace(/(^|[^\p{L}\p{N}'’])(\p{L})/gu, (_, a, b) => a + b.toUpperCase())],
  ['sentence', 'Sentence case', (s) => lower(s).replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (_, a, b) => a + b.toUpperCase())],
  [
    'camel',
    'camelCase',
    (s) =>
      words(s)
        .map((w, i) => (i ? cap(lower(w)) : lower(w)))
        .join(''),
  ],
  ['pascal', 'PascalCase', join('', (w) => cap(lower(w)))],
  ['snake', 'snake_case', join('_', lower)],
  ['constant', 'CONSTANT_CASE', join('_', (w) => w.toUpperCase())],
  ['kebab', 'kebab-case', join('-', lower)],
  ['dot', 'dot.case', join('.', lower)],
  ['path', 'path/case', join('/', lower)],
  [
    'alt',
    'sPoNgE case',
    (s) => {
      let i = 0;
      return [...lower(s)].map((c) => (c.toUpperCase() !== c.toLowerCase() ? (i++ % 2 ? c.toUpperCase() : c) : c)).join('');
    },
  ],
];

/** Convert each line separately (CRLF tolerated). */
export const convert = (fn, text) => text.split(/\r?\n/).map(fn).join('\n');
