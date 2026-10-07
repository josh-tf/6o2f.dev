// Percentage maths. Every function returns {value, steps} or {error}; `steps` is the worked arithmetic.
/** Round half away from zero to `dp` decimals, after trimming float noise (0.1 * 3 -> 0.3, 1.005 -> 1.01). */
export function round(x, dp = 2) {
  if (!Number.isFinite(x)) return x;
  const clean = Number(x.toPrecision(15)),
    s = Math.sign(clean),
    a = Math.abs(clean);
  if (a >= 1e15) return clean;
  const [m, e = '0'] = String(a).split('e'),
    r = Math.round(Number(`${m}e${Number(e) + dp}`));
  return s * Number(`${r}e-${dp}`) || 0;
}
export const fmt = (x, dp = 2) => round(x, dp).toLocaleString('en', { maximumFractionDigits: dp });
const bad = (...xs) => xs.some((x) => typeof x !== 'number' || !Number.isFinite(x));
const NUM = { error: 'Enter a number in every box.' };

/** X% of Y. */
export const pctOf = (x, y, dp = 2) => (bad(x, y) ? NUM : { value: (x / 100) * y, steps: `${fmt(x, 10)} ÷ 100 × ${fmt(y, 10)} = ${fmt((x / 100) * y, dp)}` });
/** X is what % of Y. */
export function whatPct(x, y, dp = 2) {
  if (bad(x, y)) return NUM;
  if (y === 0) return { error: 'Can’t take a percentage of zero.' };
  const v = (x / y) * 100;
  return { value: v, steps: `${fmt(x, 10)} ÷ ${fmt(y, 10)} × 100 = ${fmt(v, dp)}%` };
}
/** % change from A to B, relative to |A|. */
export function change(a, b, dp = 2) {
  if (bad(a, b)) return NUM;
  if (a === 0) return { error: b === 0 ? 'No change: both are zero.' : 'Change from zero is undefined (it would be infinite).' };
  const v = ((b - a) / Math.abs(a)) * 100;
  return {
    value: v,
    steps: `(${fmt(b, 10)} − ${fmt(a, 10)}) ÷ |${fmt(a, 10)}| × 100 = ${fmt(v, dp)}%`,
    word: v > 0 ? 'increase' : v < 0 ? 'decrease' : 'no change',
  };
}
/** Increase (dir 1) or decrease (dir -1) Y by X%. */
export function adjust(y, x, dir = 1, dp = 2) {
  if (bad(y, x)) return NUM;
  const f = 1 + (dir * x) / 100,
    v = y * f;
  return { value: v, delta: v - y, steps: `${fmt(y, 10)} × (1 ${dir > 0 ? '+' : '−'} ${fmt(x, 10)} ÷ 100) = ${fmt(y, 10)} × ${fmt(f, 10)} = ${fmt(v, dp)}` };
}
/** Reverse: the original value before an increase (dir 1) / decrease (dir -1) of X% gave `final`. */
export function original(final, x, dir = 1, dp = 2) {
  if (bad(final, x)) return NUM;
  const f = 1 + (dir * x) / 100;
  if (f === 0) return { error: 'A 100% decrease leaves zero, so the original can’t be recovered.' };
  if (f < 0) return { error: 'A decrease of more than 100% isn’t possible.' };
  const v = final / f;
  return { value: v, steps: `${fmt(final, 10)} ÷ (1 ${dir > 0 ? '+' : '−'} ${fmt(x, 10)} ÷ 100) = ${fmt(final, 10)} ÷ ${fmt(f, 10)} = ${fmt(v, dp)}` };
}
/** Going from rate a% to b%: the difference in percentage points and the relative percent change. */
export function points(a, b, dp = 2) {
  if (bad(a, b)) return NUM;
  const pp = b - a,
    rel = a === 0 ? null : (pp / Math.abs(a)) * 100;
  return {
    value: pp,
    rel,
    steps:
      `${fmt(b, 10)}% − ${fmt(a, 10)}% = ${fmt(pp, dp)} percentage point${Math.abs(round(pp, dp)) === 1 ? '' : 's'}` +
      (rel === null ? '; relative change undefined from 0%' : `; ${fmt(pp, 10)} ÷ ${fmt(Math.abs(a), 10)} × 100 = ${fmt(rel, dp)}% relative change`),
  };
}
/** Two successive discounts d1% then d2% (optionally on a price). The combined discount is not d1 + d2. */
export function stack(d1, d2, price, dp = 2) {
  if (bad(d1, d2)) return NUM;
  if (d1 > 100 || d2 > 100) return { error: 'A discount can’t be more than 100%.' };
  const keep = (1 - d1 / 100) * (1 - d2 / 100),
    v = (1 - keep) * 100;
  const hasPrice = typeof price === 'number' && Number.isFinite(price);
  return {
    value: v,
    final: hasPrice ? price * keep : null,
    steps:
      `1 − (1 − ${fmt(d1, 10)}%) × (1 − ${fmt(d2, 10)}%) = 1 − ${fmt(1 - d1 / 100, 10)} × ${fmt(1 - d2 / 100, 10)} = ${fmt(v, dp)}%, not ${fmt(d1 + d2, 10)}%` +
      (hasPrice ? `; ${fmt(price, 10)} × ${fmt(keep, 10)} = ${fmt(price * keep, dp)}` : ''),
  };
}
