// Date arithmetic on wall-clock fields. A "fields" object is {y, m (1-12), d, h, mi}. Calendar maths (years, months, days)
// works on the fields, so local DST never shifts a date; hours and the totals are real elapsed time in the chosen zone.
const DAY = 86400000;
export const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export const daysInMonth = (y, m) => [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
const pad = (n, w = 2) => String(n).padStart(w, '0');
/** Day number since 1970-01-01 of a calendar date (no time zone involved). */
const fromDayNum = (n) => {
  const t = new Date(n * DAY);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
};
// Date.UTC maps years 0-99 to 1900-1999; setUTCFullYear does not.
const utcMs = (y, m, d, h = 0, mi = 0) => {
  const t = new Date(Date.UTC(2000, 0, 1, h, mi));
  t.setUTCFullYear(y, m - 1, d);
  return t.getTime();
};
/** Day number since 1970-01-01 of a calendar date (no time zone involved). */
export const dayNum = ({ y, m, d }) => Math.floor(utcMs(y, m, d) / DAY);

/** "2026-02-28" or "2026-02-28T13:45" -> fields, or null. */
export function parse(s) {
  const r = /^(-?\d{4,6})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(s ?? '').trim());
  if (!r) return null;
  const [y, m, d, h = 0, mi = 0] = r.slice(1).map((x) => (x === undefined ? 0 : Number(x)));
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m) || h > 23 || mi > 59) return null;
  return { y, m, d, h, mi };
}
export const isoDate = ({ y, m, d }) => `${y < 0 ? '-' : ''}${pad(Math.abs(y), 4)}-${pad(m)}-${pad(d)}`;
export const isoDateTime = (f) => `${isoDate(f)}T${pad(f.h)}:${pad(f.mi)}`;

/** Fields -> epoch ms, in UTC or in the runtime's local zone. A local time skipped by DST lands on the next valid instant. */
export function toMs(f, utc) {
  if (utc) return utcMs(f.y, f.m, f.d, f.h, f.mi);
  const t = new Date(2000, 0, 1, 0, 0);
  t.setFullYear(f.y, f.m - 1, f.d);
  t.setHours(f.h, f.mi, 0, 0);
  return t.getTime();
}
export function fromMs(ms, utc) {
  const t = new Date(ms);
  return utc
    ? { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes() }
    : { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate(), h: t.getHours(), mi: t.getMinutes() };
}

/** Add whole calendar months; the day is clamped to the month's end (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(f, n) {
  const t = f.y * 12 + (f.m - 1) + n,
    y = Math.floor(t / 12),
    m = t - y * 12 + 1;
  return { ...f, y, m, d: Math.min(f.d, daysInMonth(y, m)) };
}
export const addDays = (f, n) => ({ ...f, ...fromDayNum(dayNum(f) + n) });

/** Add {years, months, weeks, days, hours} (any may be negative). Years and months first with month-end clamping, then
 *  days and weeks on the calendar, then hours as elapsed time (so +24 h across a DST change is not always the same clock time). */
export function add(f, { years = 0, months = 0, weeks = 0, days = 0, hours = 0 } = {}, utc = false) {
  let r = addDays(addMonths(f, years * 12 + months), weeks * 7 + days);
  if (hours) r = fromMs(toMs(r, utc) + hours * 3600000, utc);
  return r;
}

/** Calendar difference a -> b: {sign, years, months, days, hours, minutes}, chosen so that add(a, result) === b. */
export function diff(a, b) {
  const ka = toMs(a, true),
    kb = toMs(b, true); // wall-clock order
  if (kb < ka) {
    const r = diff(b, a);
    return { ...r, sign: r.sign && -1 };
  }
  let months = (b.y - a.y) * 12 + (b.m - a.m);
  while (months > 0 && toMs(addMonths(a, months), true) > kb) months--;
  const mid = addMonths(a, months);
  let mins = Math.round((kb - toMs(mid, true)) / 60000);
  const days = Math.floor(mins / 1440);
  mins -= days * 1440;
  return { sign: kb === ka ? 0 : 1, years: Math.floor(months / 12), months: months % 12, days, hours: Math.floor(mins / 60), minutes: mins % 60 };
}

/** ISO 8601 week: weeks start Monday, week 1 holds the year's first Thursday. Returns {year, week, weekday 1-7}. */
export function isoWeek(f) {
  const n = dayNum(f),
    wd = ((new Date(n * DAY).getUTCDay() + 6) % 7) + 1;
  const thu = fromDayNum(n + 4 - wd);
  return { year: thu.y, week: Math.floor((dayNum(thu) - dayNum({ y: thu.y, m: 1, d: 1 })) / 7) + 1, weekday: wd };
}
export const weekdayName = (f) => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][isoWeek(f).weekday - 1];
export const dayOfYear = (f) => dayNum(f) - dayNum({ y: f.y, m: 1, d: 1 }) + 1;
export const isoWeekString = (f) => {
  const w = isoWeek(f);
  return `${w.year}-W${pad(w.week)}-${w.weekday}`;
};

/** Pull every YYYY-MM-DD out of free text (one per line, commas, a pasted table...). Invalid dates are reported. */
export function parseHolidays(text) {
  const set = new Set(),
    bad = [];
  for (const m of String(text).matchAll(/\d{4}-\d{2}-\d{2}/g)) {
    const f = parse(m[0]);
    if (f) set.add(dayNum(f));
    else bad.push(m[0]);
  }
  return { set, bad };
}
/** Business days from a to b: weekdays in [a, b) that are not holidays (a set of dayNums). Negative when b < a. */
export function businessDays(a, b, holidays = new Set()) {
  let s = dayNum(a),
    e = dayNum(b),
    sign = 1;
  if (e < s) {
    [s, e] = [e, s];
    sign = -1;
  }
  const wd = (x) => new Date(x * DAY).getUTCDay(),
    weekend = (x) => wd(x) === 0 || wd(x) === 6;
  const full = Math.floor((e - s) / 7);
  let n = full * 5,
    hol = 0; // O(1) for whole weeks, so a span of millennia stays instant
  for (let x = s + full * 7; x < e; x++) if (!weekend(x)) n++;
  for (const x of holidays)
    if (x >= s && x < e && !weekend(x)) {
      hol++;
      n--;
    }
  return { days: sign * n, holidays: hol };
}

/** Age on a date: completed years/months/days, plus days to the next birthday (Feb 29 birthdays fall on Feb 28 in common years). */
export function age(birth, on) {
  if (dayNum(on) < dayNum(birth)) return null;
  const d = diff({ ...birth, h: 0, mi: 0 }, { ...on, h: 0, mi: 0 });
  let next = addMonths(birth, (d.years + 1) * 12);
  if (dayNum(addMonths(birth, d.years * 12)) === dayNum(on)) next = on; // birthday today
  return {
    years: d.years,
    months: d.months,
    days: d.days,
    totalDays: dayNum(on) - dayNum(birth),
    nextIn: dayNum(next) - dayNum(on),
    nextWeekday: weekdayName(next),
    nextAge: dayNum(next) === dayNum(on) ? d.years : d.years + 1,
  };
}
