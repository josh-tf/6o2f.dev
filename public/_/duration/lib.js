// Durations as a number of seconds. Years and months have no fixed length: they use Gregorian averages
// (365.2425 days, 1/12 of that), which is what most converters assume.
export const UNITS = {
  years: 365.2425 * 86400,
  months: (365.2425 * 86400) / 12,
  weeks: 604800,
  days: 86400,
  hours: 3600,
  minutes: 60,
  seconds: 1,
  milliseconds: 0.001,
};
const ALIAS = {
  ms: 'milliseconds',
  msec: 'milliseconds',
  msecs: 'milliseconds',
  millisecond: 'milliseconds',
  milliseconds: 'milliseconds',
  s: 'seconds',
  sec: 'seconds',
  secs: 'seconds',
  second: 'seconds',
  seconds: 'seconds',
  m: 'minutes',
  min: 'minutes',
  mins: 'minutes',
  minute: 'minutes',
  minutes: 'minutes',
  h: 'hours',
  hr: 'hours',
  hrs: 'hours',
  hour: 'hours',
  hours: 'hours',
  d: 'days',
  day: 'days',
  days: 'days',
  w: 'weeks',
  wk: 'weeks',
  wks: 'weeks',
  week: 'weeks',
  weeks: 'weeks',
  fortnight: 'fortnight',
  fortnights: 'fortnight',
  mo: 'months',
  mos: 'months',
  month: 'months',
  months: 'months',
  y: 'years',
  yr: 'years',
  yrs: 'years',
  year: 'years',
  years: 'years',
};
const ONES = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const WORDS = {
  a: 1,
  an: 1,
  ...Object.fromEntries(ONES.map((w, i) => [w, i + 1])),
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  ...TENS,
  hundred: 100,
  half: 0.5,
  quarter: 0.25,
};
const unitSec = (u) => (u === 'fortnight' ? 2 * UNITS.weeks : UNITS[u]);
const ISO_RE =
  /^([-+])?P(?:(\d+(?:[.,]\d+)?)Y)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)W)?(?:(\d+(?:[.,]\d+)?)D)?(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?$/i;

/** ISO 8601 duration -> {seconds, parts} or {error}. Only the smallest given component may have a fraction (per the standard). */
export function parseISO(s) {
  const t = String(s).trim(),
    r = ISO_RE.exec(t);
  if (!r || /T$/i.test(t) || r.slice(2).every((x) => x === undefined)) return { error: 'Not an ISO 8601 duration. Example: P1Y2M3DT4H5M6S or PT90M.' };
  const keys = ['years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds'],
    parts = {};
  const given = keys.map((k, i) => [k, r[i + 2]]).filter(([, v]) => v !== undefined);
  if (given.slice(0, -1).some(([, v]) => /[.,]/.test(v))) return { error: 'Only the last (smallest) part of an ISO duration may have a decimal.' };
  let sec = 0;
  for (const [k, v] of given) {
    parts[k] = Number(v.replace(',', '.'));
    sec += parts[k] * UNITS[k];
  }
  return { seconds: r[1] === '-' ? -sec : sec, parts, nominal: 'years' in parts || 'months' in parts };
}

/** Clock text: "1:30:15", "90:00" (m:ss), "1:02:03:04" (d:h:m:s), fractions on the last part. */
function parseClock(t) {
  const r = /^(-)?(\d+(?::\d+){1,3})(?:\.(\d+))?$/.exec(t);
  if (!r) return null;
  const p = r[2].split(':').map(Number),
    mul = [1, 60, 3600, 86400].slice(0, p.length).reverse();
  if (p.slice(1).some((x) => x >= 60) || (p.length === 4 && p[1] >= 24))
    return { error: 'Clock values need minutes and seconds under 60 (and hours under 24 when days are given).' };
  const sec = p.reduce((t, x, i) => t + x * mul[i], 0) + (r[3] ? Number(`0.${r[3]}`) : 0);
  return { seconds: r[1] ? -sec : sec };
}

/** Free text -> {seconds} or {error}. Accepts ISO, clock text, plain numbers (in `plainUnit`), and phrases like
 *  "90 minutes", "2h30m", "1.5 days", "a week and 3 days", "an hour and a half", "half a day", "-3 h". */
export function parse(input, plainUnit = 'seconds') {
  let t = String(input ?? '')
    .trim()
    .toLowerCase();
  if (!t) return { error: 'Enter a duration.' };
  if (/^[-+]?p/.test(t)) return parseISO(t.toUpperCase());
  const clock = parseClock(t.replace(/\s+/g, ''));
  if (clock) return clock;
  if (/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/.test(t)) {
    const n = Number(t);
    return Number.isFinite(n) ? { seconds: n * UNITS[plainUnit] } : { error: 'That number is too large.' };
  }
  let sign = 1;
  if (/^-/.test(t)) {
    sign = -1;
    t = t.slice(1);
  }
  if (/\bago$/.test(t)) {
    sign = -sign;
    t = t.replace(/\s*ago$/, '');
  }
  t = t.replace(/(\d),(\d{3})\b/g, '$1$2'); // 1,000 minutes
  t = t.replace(new RegExp(`\\b(${Object.keys(TENS).join('|')})[\\s-]+(${ONES.join('|')})\\b`, 'g'), (m, a, b) => String(TENS[a] + WORDS[b])); // twenty-five
  t = t.replace(/\b(\d*\.?\d+|an?|one)\s*([a-z]+)\s+and\s+a\s+half\b/g, (m, n, u) => `${(WORDS[n] ?? Number(n)) + 0.5} ${u}`);
  t = t
    .replace(/\bhalf\s+an?\s+/g, '0.5 ')
    .replace(/\ba\s+quarter\s+of\s+an?\s+/g, '0.25 ')
    .replace(/\bquarter\s+of\s+an?\s+/g, '0.25 ');
  const bad = /[^a-z0-9.\s,+&]/.exec(t.replace(/\d*\.?\d+e[-+]?\d+/g, '0'));
  if (bad) return { error: `Didn't understand "${bad[0]}".` };
  const toks = (t.match(/\d*\.?\d+(?:e[-+]?\d+)?|[a-z]+/g) || []).filter((w) => w !== 'and');
  let sec = 0,
    n = 0;
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i],
      val = /^[\d.]/.test(w) ? Number(w) : WORDS[w];
    if (val === undefined) {
      if (ALIAS[w] && n === 0 && i === 0) {
        sec += unitSec(ALIAS[w]);
        n++;
        continue;
      } // "week and 3 days"
      return { error: `Didn't understand "${w}". Try "2h 30m", "90 minutes" or "1:30:00".` };
    }
    const unit = toks[i + 1];
    if (unit === undefined || /^[\d.]/.test(unit)) return { error: `"${w}" needs a unit, like ${w} min or ${w} h.` };
    if (!ALIAS[unit]) return { error: `Unknown unit "${unit}". Use ms, s, min, h, d, w, mo or y.` };
    sec += val * unitSec(ALIAS[unit]);
    n++;
    i++;
  }
  if (!n) return { error: 'Enter a duration, like 2h 30m.' };
  return { seconds: sign * sec, nominal: /\b(mo|mos|months?|y|yrs?|years?)\b/.test(t) };
}

/** Round to `dp` decimals without float noise (0.1 + 0.2 -> 0.3). */
export const round = (x, dp = 3) => {
  const f = 10 ** dp;
  return Math.round(Number((x * f).toPrecision(15))) / f;
};
const num = (x, dp = 3) => String(round(x, dp));

/** Split |seconds| into units from `largest` down to seconds (with ms as a fraction). */
export function split(seconds, largest = 'days') {
  const order = ['years', 'months', 'weeks', 'days', 'hours', 'minutes'];
  let rest = round(Math.abs(seconds), 3);
  const out = [];
  for (const u of order.slice(order.indexOf(largest) < 0 ? order.length : order.indexOf(largest))) {
    const v = Math.floor(round(rest / UNITS[u], 9));
    if (v) {
      out.push([u, v]);
      rest = round(rest - v * UNITS[u], 3);
    }
  }
  if (rest || !out.length) out.push(['seconds', rest]);
  return out;
}

/** "1 day, 2 hours and 3.5 seconds". */
export function humanize(seconds, largest = 'days') {
  const parts = split(seconds, largest).map(([u, v]) => `${num(v)} ${v === 1 ? u.slice(0, -1) : u}`);
  const s = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];
  return seconds < 0 ? `minus ${s}` : s;
}

/** ISO 8601 text. largest 'days' (P1DT2H) or 'hours' (PT26H); never years/months, so the result is exact. */
export function toISO(seconds, largest = 'days') {
  const p = Object.fromEntries(split(seconds, largest === 'weeks' ? 'weeks' : largest));
  const date = (p.weeks ? `${p.weeks}W` : '') + (p.days ? `${p.days}D` : '');
  const time = (p.hours ? `${p.hours}H` : '') + (p.minutes ? `${p.minutes}M` : '') + (p.seconds ? `${num(p.seconds)}S` : '');
  return `${seconds < 0 ? '-' : ''}P${date}${time ? `T${time}` : date ? '' : 'T0S'}`;
}

/** "26:03:04.5" style clock: hours can exceed 24. */
export function toClock(seconds) {
  const a = round(Math.abs(seconds), 3),
    h = Math.floor(a / 3600),
    m = Math.floor((a % 3600) / 60),
    s = round(a - h * 3600 - m * 60, 3);
  const ss = s < 10 ? `0${s}` : String(s);
  return `${seconds < 0 ? '-' : ''}${h}:${String(m).padStart(2, '0')}:${ss}`;
}

/** The duration expressed in every unit. */
export const totals = (seconds) => Object.entries(UNITS).map(([u, f]) => [u, seconds / f]);
