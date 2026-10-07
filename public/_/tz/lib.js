const fmts = new Map();
const dtf = (zone) =>
  fmts.get(zone) ??
  (fmts.set(
    zone,
    new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  ),
  fmts.get(zone));

/** Wall-clock fields of an instant in a zone. */
export function wall(zone, ms) {
  const o = {};
  for (const { type, value } of dtf(zone).formatToParts(ms)) o[type] = +value;
  return { y: o.year, mo: o.month, d: o.day, h: o.hour, mi: o.minute, s: o.second };
}
const asUtc = (w) => Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s);

/** UTC offset of a zone at an instant, in minutes. */
export const offset = (zone, ms) => Math.round((asUtc(wall(zone, Math.floor(ms / 1000) * 1000)) - Math.floor(ms / 1000) * 1000) / 60000);

/** Instant (ms) for a wall time "YYYY-MM-DDTHH:MM" in a zone. Gaps/overlaps resolve like the usual two-pass guess. */
export function fromWall(zone, str) {
  const [y, mo, d, h, mi] = str.split(/\D/).map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const t = guess - offset(zone, guess) * 60000;
  return guess - offset(zone, t) * 60000;
}

export function fmtOffset(min) {
  const a = Math.abs(min),
    h = Math.floor(a / 60),
    m = a % 60;
  return `UTC${min < 0 ? '-' : '+'}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
}

/** Calendar-day difference of a zone's date vs the base zone's date at the same instant (-1, 0, +1 ...). */
export function dayDiff(zone, base, ms) {
  const a = wall(zone, ms),
    b = wall(base, ms);
  return Math.round((Date.UTC(a.y, a.mo - 1, a.d) - Date.UTC(b.y, b.mo - 1, b.d)) / 864e5);
}

export const validZone = (z) => {
  try {
    dtf(z);
    return true;
  } catch {
    return false;
  }
};
export const city = (z) => z.split('/').pop().replace(/_/g, ' ');
export const isWork = (h) => h >= 9 && h < 17;
