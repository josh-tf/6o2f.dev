// Descriptive statistics. Pure functions, no DOM.

/** Split on commas, semicolons, pipes and whitespace. Leading currency signs and a trailing % are dropped; other tokens are skipped. */
export function parse(text) {
  const nums = [],
    skipped = [];
  for (const tok of String(text).split(/[\s,;|]+/)) {
    if (!tok) continue;
    const t = tok.replace(/^[$€£¥]/, '').replace(/%$/, '');
    const v = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t) ? Number(t) : NaN;
    Number.isFinite(v) ? nums.push(v) : skipped.push(tok);
  }
  return { nums, skipped };
}

/** Neumaier-compensated sum, so 0.1 + 0.2 + ... does not drift. */
export function sum(a) {
  let s = 0,
    c = 0;
  for (const x of a) {
    const t = s + x;
    c += Math.abs(s) >= Math.abs(x) ? s - t + x : x - t + s;
    s = t;
  }
  return s + c;
}

/** Quantile of a sorted array, p in [0,1].
 *  'inclusive' = linear interpolation between closest ranks (R type 7, Excel QUARTILE.INC, NumPy default)
 *  'exclusive' = (n+1)p rank (R type 6, Excel QUARTILE.EXC, Minitab, SPSS) */
export function quantile(s, p, method = 'inclusive') {
  const n = s.length;
  if (!n) return NaN;
  const h = method === 'exclusive' ? (n + 1) * p - 1 : (n - 1) * p;
  if (h <= 0) return s[0];
  if (h >= n - 1) return s[n - 1];
  const lo = Math.floor(h);
  return s[lo] + (h - lo) * (s[lo + 1] - s[lo]);
}

const median = (s) => quantile(s, 0.5);

/** Q1/Q3. 'tukey' = medians of the lower and upper halves, the middle value excluded when n is odd (Tukey's hinges, TI-84). */
export function quartiles(s, method = 'inclusive') {
  if (method === 'tukey') {
    const h = Math.floor(s.length / 2);
    return s.length < 2 ? [s[0], s[0]] : [median(s.slice(0, h)), median(s.slice(s.length - h))];
  }
  return [quantile(s, 0.25, method), quantile(s, 0.75, method)];
}

export const PCTS = [1, 5, 10, 25, 50, 75, 90, 95, 99];

export function describe(nums, method = 'inclusive') {
  const n = nums.length;
  if (!n) return null;
  const s = [...nums].sort((a, b) => a - b),
    total = sum(s),
    mean = total / n;
  let m2 = 0,
    m3 = 0,
    m4 = 0;
  for (const x of s) {
    const d = x - mean;
    m2 += d * d;
    m3 += d * d * d;
    m4 += d * d * d * d;
  }
  const popVar = m2 / n,
    sampVar = n > 1 ? m2 / (n - 1) : NaN;
  const sd = Math.sqrt(sampVar);
  // Adjusted Fisher-Pearson skewness (Excel SKEW) and excess kurtosis (Excel KURT); undefined for tiny samples or zero spread.
  const skew = n > 2 && m2 > 0 ? (n / ((n - 1) * (n - 2))) * (m3 / sd ** 3) : NaN;
  const kurt = n > 3 && m2 > 0 ? ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * (m4 / sd ** 4) - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3)) : NaN;
  const counts = new Map();
  for (const x of s) counts.set(x, (counts.get(x) || 0) + 1);
  let top = 0;
  for (const c of counts.values()) if (c > top) top = c; // no spread: Math.max(...big) overflows the stack
  const modes = top > 1 ? [...counts].filter(([, c]) => c === top).map(([v]) => v) : [];
  const [q1, q3] = quartiles(s, method),
    iqr = q3 - q1,
    lo = q1 - 1.5 * iqr,
    hi = q3 + 1.5 * iqr;
  return {
    n,
    sum: total,
    mean,
    median: median(s),
    modes,
    modeCount: top,
    min: s[0],
    max: s[n - 1],
    range: s[n - 1] - s[0],
    sampVar,
    popVar,
    sampSd: sd,
    popSd: Math.sqrt(popVar),
    sem: sd / Math.sqrt(n),
    cv: mean ? sd / Math.abs(mean) : NaN,
    q1,
    q3,
    iqr,
    fences: [lo, hi],
    outliers: s.filter((x) => x < lo || x > hi),
    skew,
    kurt,
    percentiles: PCTS.map((p) => [p, quantile(s, p / 100, method === 'exclusive' ? 'exclusive' : 'inclusive')]),
    sorted: s,
  };
}

/** Equal-width bins from min to max; the last bin includes max. Returns [{ lo, hi, count }]. */
export function histogram(s, bins) {
  const n = s.length,
    min = s[0],
    max = s[n - 1];
  bins = Math.max(1, Math.min(200, Math.round(bins)));
  if (!n) return [];
  if (min === max) return [{ lo: min, hi: max, count: n }];
  const w = (max - min) / bins,
    out = Array.from({ length: bins }, (_, i) => ({ lo: min + i * w, hi: i === bins - 1 ? max : min + (i + 1) * w, count: 0 }));
  for (const x of s) out[Math.min(bins - 1, Math.floor((x - min) / w))].count++;
  return out;
}

/** Sturges' rule, the usual default bin count. */
export const sturges = (n) => Math.max(1, Math.ceil(Math.log2(n)) + 1);

/** Readable number: up to 10 significant digits, exponent form for very large or small values. */
export function fmt(x) {
  if (!Number.isFinite(x)) return '—';
  const a = Math.abs(x);
  if (a !== 0 && (a >= 1e15 || a < 1e-6)) return x.toExponential(6).replace(/\.?0+e/, 'e');
  return String(+x.toPrecision(10));
}
