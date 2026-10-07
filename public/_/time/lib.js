/** Parse pasted text: an epoch (seconds or milliseconds, auto-detected by magnitude) or any date string. Returns {date, kind} or null. */
export function parse(s) {
  s = String(s ?? '').trim();
  if (!s) return null;
  let d, kind;
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    // Unit by magnitude: |n| >= 1e11 is ms (year 5138 in seconds, 1973 in ms), >= 1e14 µs, 1e17-1e19 ns (Go/Rust/OTel).
    const n = +s,
      a = Math.abs(n);
    [kind, d] =
      a >= 1e17 && a < 1e19
        ? ['nanoseconds', n / 1e6]
        : a >= 1e14 && a < 1e17
          ? ['microseconds', n / 1e3]
          : a >= 1e11
            ? ['milliseconds', n]
            : ['seconds', n * 1000];
    d = new Date(d);
  } else {
    d = new Date(s);
    kind = 'date string';
  }
  return isNaN(d) ? null : { date: d, kind };
}

const U = [
  ['year', 31557600],
  ['month', 2629800],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
];
/** "3 hours ago" / "in 2 days" / "now". */
export function relative(date, now = Date.now()) {
  const diff = Math.round((date - now) / 1000);
  if (Math.abs(diff) < 5) return 'just now';
  const [u, sec] = U.find(([, sec]) => Math.abs(diff) >= sec);
  return new Intl.RelativeTimeFormat('en', { numeric: 'always' }).format(Math.trunc(diff / sec), u);
}

/** Value for <input type=datetime-local step=1> in local time. */
export const toLocalInput = (d) => new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
