import { randRange } from './lib.js';

/** "3d6+2" -> {n, m, k}; the count is optional ("d20"). Returns null when invalid or too large. */
export function parseDice(s) {
  const x = /^(\d*)d(\d+)\s*(?:([+-])\s*(\d+))?$/i.exec(s.trim());
  if (!x) return null;
  const n = x[1] === '' ? 1 : +x[1],
    m = +x[2],
    k = x[3] ? (x[3] === '-' ? -x[4] : +x[4]) : 0;
  return n < 1 || n > 1000 || m < 1 || m > 1e6 || Math.abs(k) > 1e9 ? null : { n, m, k };
}

export function roll({ n, m, k }) {
  const rolls = Array.from({ length: n }, () => randRange(1, m));
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) + k };
}
