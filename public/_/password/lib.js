import { randInt, randRange } from '../random/lib.js';
import WORDS from './words.js';

export const SETS = { lower: 'abcdefghijklmnopqrstuvwxyz', upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', digits: '0123456789', symbols: '!@#$%^&*()-_=+[]{};:,.?/' };
const LOOKALIKE = /[Il1O0o|]/g;

/** Selected character sets (names) minus look-alikes if asked; empty sets dropped. */
export const sets = (names, noLook) => names.map((n) => (noLook ? SETS[n].replace(LOOKALIKE, '') : SETS[n]));

export const bits = (poolSize, n) => n * Math.log2(poolSize);

/** Uniform draw from the union of the sets, retried until every selected set appears (still unbiased). */
export function password(length, names, noLook, src) {
  const ss = sets(names, noLook),
    pool = [...ss.join('')];
  if (!pool.length || length < ss.length) throw new RangeError('Pick at least one character set');
  for (;;) {
    const p = Array.from({ length }, () => pool[randInt(pool.length, src)]);
    if (ss.every((s) => p.some((c) => s.includes(c)))) return p.join('');
  }
}

export function passphrase(n, { sep = '-', cap, num } = {}, src) {
  const w = Array.from({ length: n }, () => WORDS[randInt(WORDS.length, src)]).map((x) => (cap ? x[0].toUpperCase() + x.slice(1) : x));
  if (num) w.push(String(randRange(0, 99, src)).padStart(2, '0'));
  return w.join(sep);
}

/** Entropy of a generated passphrase: words from the list, plus 100 values for the optional 2-digit number. */
export const phraseBits = (n, num) => bits(WORDS.length, n) + (num ? Math.log2(100) : 0);

export function verdict(b) {
  return b < 40
    ? ['Weak', 'Guessable by a determined attacker; fine only for throwaway use.']
    : b < 64
      ? ['Fair', 'Resists casual guessing but not an offline attack on a fast hash.']
      : b < 80
        ? ['Strong', 'Good for most accounts.']
        : b < 128
          ? ['Very strong', 'Out of reach of brute force today.']
          : ['Excellent', 'Far beyond any realistic brute force.'];
}
