// Year calendar maths. Dates are {y, m (1-12), d}; all arithmetic is on UTC day numbers, so time zones never shift a day.
const DAY = 86400000;
const utc = (y, m, d) => {
  const t = new Date(0);
  t.setUTCFullYear(y, m - 1, d);
  return t;
}; // years 0-99 stay literal
export const dayNum = ({ y, m, d }) => Math.round(utc(y, m, d).getTime() / DAY);
export const fromDayNum = (n) => {
  const t = new Date(n * DAY);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
};
export const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export const daysInMonth = (y, m) => [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
/** ISO weekday, 1 = Monday ... 7 = Sunday. */
export const isoWeekday = (f) => ((((dayNum(f) + 3) % 7) + 7) % 7) + 1; // 1970-01-01 was a Thursday
/** ISO 8601 week: {year, week}. Week 1 contains the year's first Thursday. */
export function isoWeek(f) {
  const thu = fromDayNum(dayNum(f) + 4 - isoWeekday(f));
  return { year: thu.y, week: Math.floor((dayNum(thu) - dayNum({ y: thu.y, m: 1, d: 1 })) / 7) + 1 };
}
export const weeksInYear = (y) => isoWeek({ y, m: 12, d: 28 }).week;
export const dayOfYear = (f) => dayNum(f) - dayNum({ y: f.y, m: 1, d: 1 }) + 1;
const pad = (n, w = 2) => String(n).padStart(w, '0');
export const iso = ({ y, m, d }) => `${y < 0 ? '-' : ''}${pad(Math.abs(y), 4)}-${pad(m)}-${pad(d)}`;
export const isoWeekDate = (f) => {
  const w = isoWeek(f);
  return `${w.year}-W${pad(w.week)}-${isoWeekday(f)}`;
};
export function parse(s) {
  const r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).trim());
  if (!r) return null;
  const [y, m, d] = r.slice(1).map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m) ? { y, m, d } : null;
}

/** Rows of one month for a week starting Monday (1) or Sunday (0). Each row: {week (ISO week of the row's Monday), days: [f|null] x 7}. */
export function monthRows(y, m, weekStart = 1) {
  const first = { y, m, d: 1 },
    lead = (isoWeekday(first) - (weekStart === 1 ? 1 : 0)) % 7; // blanks before the 1st
  const rows = [],
    n = daysInMonth(y, m),
    start = dayNum(first) - lead;
  for (let r = 0; r * 7 < lead + n; r++) {
    const days = Array.from({ length: 7 }, (_, i) => {
      const k = start + r * 7 + i,
        f = fromDayNum(k);
      return f.m === m && f.y === y ? f : null;
    });
    const rowStart = fromDayNum(start + r * 7),
      monday = weekStart === 1 ? rowStart : fromDayNum(start + r * 7 + 1);
    rows.push({ week: isoWeek(monday).week, days });
  }
  return rows;
}
