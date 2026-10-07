const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
const PREFIX = { 2: /^0b/, 8: /^0o/, 16: /^0x/ };

/** Parse text in `base` (2-36) to a BigInt. Accepts a leading -/+, 0b/0o/0x prefix, spaces and underscores. Returns null if invalid or empty. */
export function parse(text, base) {
  let s = text.toLowerCase().replace(/[\s_]/g, ''),
    neg = false;
  if (s[0] === '-' || s[0] === '+') {
    neg = s[0] === '-';
    s = s.slice(1);
  }
  if (PREFIX[base]) s = s.replace(PREFIX[base], '');
  if (!s) return null;
  const B = BigInt(base);
  let n = 0n;
  for (const c of s) {
    const d = DIGITS.indexOf(c);
    if (d < 0 || d >= base) return null;
    n = n * B + BigInt(d);
  }
  return neg ? -n : n;
}

export const format = (n, base) => n.toString(base);

export const BITS = 64;
/** Value fits a 64-bit grid, read as unsigned or as signed two's complement. */
export const fits64 = (n) => n >= -(1n << 63n) && n < 1n << 64n;
/** Toggle bit `i` (0 = least significant) of a 64-bit value. A negative value stays signed. */
export function toggle(n, i) {
  const u = BigInt.asUintN(BITS, n) ^ (1n << BigInt(i));
  return n < 0n ? BigInt.asIntN(BITS, u) : u;
}

/** Minimal big-endian bytes: magnitude for n >= 0, two's complement for n < 0. */
export function bytes(n) {
  let len = 1;
  if (n >= 0n) while (n >> BigInt(len * 8) > 0n) len++;
  else while (n < -(1n << BigInt(len * 8 - 1))) len++;
  const u = BigInt.asUintN(len * 8, n),
    out = [];
  for (let i = len - 1; i >= 0; i--)
    out.push(
      Number((u >> BigInt(i * 8)) & 255n)
        .toString(16)
        .padStart(2, '0'),
    );
  return out;
}
