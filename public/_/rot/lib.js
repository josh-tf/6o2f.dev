// Classical ciphers. Pure functions; case and non-letters are preserved unless noted.
const A = 65,
  a = 97;
const mod = (n, m) => ((n % m) + m) % m;
/** Map every ASCII letter through f(index 0-25). */
const mapLetters = (s, f) =>
  s.replace(/[A-Za-z]/g, (ch) => {
    const base = ch < 'a' ? A : a;
    return String.fromCharCode(base + mod(f(ch.charCodeAt(0) - base), 26));
  });

export const caesar = (s, k) => mapLetters(s, (x) => x + k);
export const rot13 = (s) => caesar(s, 13);
export const atbash = (s) => mapLetters(s, (x) => 25 - x);
/** ROT47 rotates the 94 printable ASCII characters ! (33) to ~ (126). */
export const rot47 = (s) => s.replace(/[!-~]/g, (c) => String.fromCharCode(33 + ((c.charCodeAt(0) - 33 + 47) % 94)));

/** Vigenere: the key's letters only (others ignored); the key advances on letters of the text only. Returns null for a key with no letters. */
export function vigenere(s, key, decode = false) {
  const ks = [...key.toUpperCase()].filter((c) => c >= 'A' && c <= 'Z').map((c) => c.charCodeAt(0) - A);
  if (!ks.length) return null;
  let i = 0;
  return mapLetters(s, (x) => x + (decode ? -1 : 1) * ks[i++ % ks.length]);
}

const railPattern = (n, rails) => {
  // rail index for each position of a zigzag
  if (rails < 2 || rails >= n) return Array.from({ length: n }, (_, i) => (rails < 2 ? 0 : i));
  const cycle = 2 * (rails - 1);
  return Array.from({ length: n }, (_, i) => {
    const r = i % cycle;
    return r < rails ? r : cycle - r;
  });
};
/** Rail fence over code points (every character, spaces included, takes part). rails >= 2 or the text is returned unchanged. */
export function railFence(s, rails, decode = false) {
  const ch = [...s],
    pat = railPattern(ch.length, rails);
  const order = ch.map((_, i) => i).sort((x, y) => pat[x] - pat[y] || x - y); // reading order of the rails
  const out = new Array(ch.length);
  if (!decode) order.forEach((src, i) => (out[i] = ch[src]));
  else order.forEach((dst, i) => (out[dst] = ch[i]));
  return out.join('');
}

export const gcd = (x, y) => (y ? gcd(y, x % y) : x);
export const AFFINE_A = [1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25]; // the 12 values coprime with 26
export const inv26 = (x) => AFFINE_A.find((v) => (v * x) % 26 === 1);
/** Affine: E(x) = a*x + b, D(y) = a^-1 * (y - b), mod 26. Returns null when a is not coprime with 26. */
export function affine(s, a, b, decode = false) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || gcd(mod(a, 26), 26) !== 1) return null;
  const ia = inv26(mod(a, 26));
  return mapLetters(s, (x) => (decode ? ia * (x - b) : a * x + b));
}

// Relative English letter frequencies (percent), A..Z.
export const FREQ = [
  8.167, 1.492, 2.782, 4.253, 12.702, 2.228, 2.015, 6.094, 6.966, 0.153, 0.772, 4.025, 2.406, 6.749, 7.507, 1.929, 0.095, 5.987, 6.327, 9.056, 2.758, 0.978,
  2.36, 0.15, 1.974, 0.074,
];
/** Chi-squared distance between the text's letter counts and English; lower = more English. Infinity with fewer than 1 letter. */
export function englishScore(s) {
  const cnt = new Array(26).fill(0);
  let n = 0;
  for (const c of s.toUpperCase())
    if (c >= 'A' && c <= 'Z') {
      cnt[c.charCodeAt(0) - A]++;
      n++;
    }
  if (!n) return Infinity;
  return cnt.reduce((t, o, i) => {
    const e = (FREQ[i] / 100) * n;
    return t + (o - e) ** 2 / e;
  }, 0);
}
/** All 25 candidate plaintexts: row k assumes the text was shifted forward by k. `best` is the lowest score, or -1 when there are fewer than 4 letters to judge by.
 *  ponytail: only the first 4000 characters are tried and scored (plenty for frequency analysis; keeps typing in a huge paste fast). */
export function bruteForce(text) {
  const s = text.slice(0, 4000);
  const rows = Array.from({ length: 25 }, (_, i) => {
    const k = i + 1,
      text = caesar(s, -k);
    return { shift: k, text, score: englishScore(text) };
  });
  const letters = (s.match(/[A-Za-z]/g) || []).length;
  let best = -1;
  if (letters >= 4) best = rows.reduce((m, r, i) => (r.score < rows[m].score ? i : m), 0);
  return { rows, best };
}
