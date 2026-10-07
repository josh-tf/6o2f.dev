// 5-field cron: parse, explain, next runs. Day-of-month and day-of-week are OR-ed when both are restricted (Vixie cron).
const MACROS = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const FIELDS = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'day-of-month', min: 1, max: 31 },
  { name: 'month', min: 1, max: 12, names: MONTHS, off: 1 },
  { name: 'day-of-week', min: 0, max: 7, names: DAYS, off: 0 },
];

function field(raw, f) {
  const set = new Set(),
    bad = (why) => {
      throw new Error(`Invalid ${f.name} field "${raw}": ${why}`);
    };
  const num = (s) => {
    if (f.names) {
      const i = f.names.indexOf(s.toUpperCase());
      if (i >= 0) return i + f.off;
    }
    if (!/^\d+$/.test(s)) bad(`"${s}" is not a number${f.names ? ' or name' : ''}`);
    if (+s < f.min || +s > f.max) bad(`${s} is outside ${f.min}-${f.max}`);
    return +s;
  };
  if (!raw) bad('empty');
  for (const part of raw.split(',')) {
    const [range, step, extra] = part.split('/');
    if (extra !== undefined || step === '') bad('malformed step');
    if (step !== undefined && (!/^\d+$/.test(step) || +step < 1)) bad(`step "${step}" must be a positive number`);
    let lo, hi;
    if (range === '*') [lo, hi] = [f.min, f.name === 'day-of-week' ? 6 : f.max];
    else if (range.includes('-')) {
      const [a, b, c] = range.split('-');
      if (c !== undefined || a === '' || b === '') bad(`malformed range "${range}"`);
      [lo, hi] = [num(a), num(b)];
      if (lo > hi) bad(`range ${range} runs backwards`);
    } else {
      lo = num(range);
      hi = step === undefined ? lo : f.name === 'day-of-week' ? 6 : f.max;
    }
    for (let v = lo; v <= hi; v += +(step ?? 1)) set.add(f.name === 'day-of-week' ? v % 7 : v);
  }
  return set;
}

/** Throws Error naming the bad field. Returns { raw: string[5], sets: Set<number>[5], expr } */
export function parse(expr) {
  expr = expr.trim().replace(/\s+/g, ' ');
  if (expr.startsWith('@')) {
    const m = MACROS[expr.toLowerCase()];
    if (!m) throw new Error(`Unknown shortcut "${expr}". Use ${Object.keys(MACROS).join(', ')}`);
    expr = m;
  }
  const raw = expr.split(' ');
  if (raw.length !== 5) throw new Error(`Expected 5 fields (minute hour day-of-month month day-of-week), got ${expr ? raw.length : 0}`);
  return { raw, sets: raw.map((r, i) => field(r, FIELDS[i])) };
}

/** Next n run times strictly after `from` (a Date), as Dates. utc=false uses the viewer's local zone. Looks ahead at most ~9 years. */
export function nextRuns({ raw, sets }, from, n = 10, utc = false) {
  const [mi, hh, dom, mon, dow] = sets,
    bothDays = raw[2][0] !== '*' && raw[4][0] !== '*';
  const get = (d) =>
    utc
      ? [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCDay()]
      : [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getDay()];
  const make = (y, m, d, h, i) => (utc ? new Date(Date.UTC(y, m, d, h, i)) : new Date(y, m, d, h, i));
  const out = [],
    limit = from.getTime() + 9 * 366 * 864e5;
  let t = new Date(Math.floor(from.getTime() / 6e4) * 6e4 + 6e4);
  while (out.length < n && t.getTime() <= limit) {
    const [y, m, d, h, i, wd] = get(t);
    const dayOk = bothDays ? dom.has(d) || dow.has(wd) : dom.has(d) && dow.has(wd);
    let next;
    if (!mon.has(m + 1)) next = make(y, m + 1, 1, 0, 0);
    else if (!dayOk) next = make(y, m, d + 1, 0, 0);
    else if (!hh.has(h)) next = make(y, m, d, h + 1, 0);
    else if (!mi.has(i)) next = make(y, m, d, h, i + 1);
    else {
      out.push(t);
      next = new Date(t.getTime() + 6e4);
    }
    t = next.getTime() > t.getTime() ? next : new Date(t.getTime() + 6e4); // DST fall-back can repeat a wall time: always move forward
  }
  return out;
}

const list = (a) => (a.length < 2 ? String(a[0]) : `${a.slice(0, -1).join(', ')} and ${a.at(-1)}`);
const ord = (v, f) =>
  f.names
    ? [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ][f.names === DAYS ? v % 7 : v + 6]
    : v;
// words for one field's parts: every 5 minutes, minutes 1 through 5, 7
function words(raw, i) {
  const f = FIELDS[i],
    val = (s) => {
      const k = f.names?.indexOf(s.toUpperCase());
      return ord(k >= 0 ? k + f.off : +s, f);
    };
  return raw.split(',').map((p) => {
    const [r, s] = p.split('/'),
      every = s && `every ${s} ${f.name === 'day-of-month' ? 'days' : f.name + 's'}`;
    if (r === '*') return every || '';
    const [a, b] = r.split('-'),
      span = b !== undefined ? `${val(a)} through ${val(b)}` : val(a);
    return s ? `${every} from ${span}` : span;
  });
}
export function explain({ raw }) {
  const [m, h, dm, mo, dw] = raw,
    p = [],
    pad = (x) => String(x).padStart(2, '0');
  const plain = (s) => /^\d+$/.test(s);
  if (plain(m) && h.split(',').every(plain)) p.push('At ' + list(h.split(',').map((x) => `${pad(x)}:${pad(m)}`)));
  else {
    const mw = list(words(m, 0));
    p.push(m === '*' ? 'Every minute' : mw.startsWith('every') ? 'E' + mw.slice(1) : `At minute ${mw}`);
    if (h !== '*') p.push(/^\*\/\d+$/.test(h) ? `of every ${h.slice(2)} hours` : `past hour ${list(words(h, 1))}`);
    else if (m !== '*' && !/^\*\/\d+$/.test(m)) p.push('of every hour');
  }
  const days = [],
    dmw = dm !== '*' && list(words(dm, 2));
  if (dm !== '*') days.push(dmw.startsWith('every') ? dmw : `day-of-month ${dmw}`);
  if (dw !== '*') days.push(list(words(dw, 4)).replace(/^(?=[A-Z])/, ''));
  if (days.length === 2) p.push(`on ${days[0]} or ${days[1]}`);
  else if (dm !== '*') p.push(`on ${days[0]}`);
  else if (dw !== '*') p.push(`on ${days[0]}`);
  if (mo !== '*') p.push(`in ${list(words(mo, 3))}`);
  return p.join(' ');
}

/** Short "in 2 d 3 h" / "in 5 min" distance from `now` to `d` (both Dates), for the run list. */
export function until(d, now) {
  let m = Math.round((d - now) / 6e4);
  if (m < 1) return 'in under a minute';
  const parts = [],
    day = Math.floor(m / 1440),
    h = Math.floor((m % 1440) / 60);
  m %= 60;
  if (day) parts.push(`${day} d`);
  if (h) parts.push(`${h} h`);
  if (m && !day) parts.push(`${m} min`);
  return 'in ' + (parts.join(' ') || '0 min');
}
