// Shared randomness: everything in the random/uuid/password tools draws from here (crypto only, no modulo bias).
const fill = (a) => crypto.getRandomValues(a);

/** Uniform integer in [0, n) for 1 <= n <= 2^53, by rejection sampling. `src` fills a typed array (injectable for tests). */
export function randInt(n, src = fill) {
  if (!Number.isSafeInteger(n) || n < 1) throw new RangeError('n must be a positive safe integer');
  if (n === 1) return 0;
  if (n <= 2 ** 32) {
    const lim = 2 ** 32 - (2 ** 32 % n),
      a = new Uint32Array(1);
    for (;;) {
      src(a);
      if (a[0] < lim) return a[0] % n;
    }
  }
  const N = BigInt(n),
    lim = 2n ** 64n - (2n ** 64n % N),
    a = new BigUint64Array(1);
  for (;;) {
    src(a);
    if (a[0] < lim) return Number(a[0] % N);
  }
}

/** Random bytes. */
export const randBytes = (n) => fill(new Uint8Array(n));

/** Integer in [min, max] inclusive. */
export const randRange = (min, max, src) => {
  if (!(max >= min)) throw new RangeError('max must be >= min');
  return min + randInt(max - min + 1, src);
};

/** Fisher-Yates; returns a new array. */
export function shuffle(list, src) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1, src);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
