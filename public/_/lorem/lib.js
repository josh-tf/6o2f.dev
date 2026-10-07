// Deterministic placeholder text: same seed + options => same text.
const WORDS =
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum'.split(
    ' ',
  );
const OPENER = WORDS.slice(0, 8);

/** mulberry32: small seeded PRNG, returns () => float in [0,1). */
export function prng(seed) {
  let a = (typeof seed === 'string' ? [...seed].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7) : seed) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cap = (s) => s[0].toUpperCase() + s.slice(1);

/** kind: 'paragraphs' | 'sentences' | 'words'. Returns a string (paragraphs separated by a blank line, or <p> wrapped). */
export function generate({ kind = 'paragraphs', count = 3, seed = 1, start = true, html = false } = {}) {
  const r = prng(seed),
    n = Math.max(1, Math.min(1000, Math.floor(count) || 1));
  const int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const words = (k) => Array.from({ length: k }, () => WORDS[int(0, WORDS.length - 1)]);
  let first = start;
  const sentence = () => {
    const w = words(int(5, 13));
    if (first) {
      w.splice(0, OPENER.length, ...OPENER);
      first = false;
    }
    if (w.length > 8) w[int(3, w.length - 4)] += ',';
    return cap(w.join(' ')) + '.';
  };
  const para = () => Array.from({ length: int(3, 6) }, sentence).join(' ');
  if (kind === 'words') {
    const w = words(n);
    if (start) w.splice(0, Math.min(n, OPENER.length), ...OPENER.slice(0, n));
    return w.join(' ');
  }
  if (kind === 'sentences') return Array.from({ length: n }, sentence).join(' ');
  const ps = Array.from({ length: n }, para);
  return html ? ps.map((p) => `<p>${p}</p>`).join('\n') : ps.join('\n\n');
}
