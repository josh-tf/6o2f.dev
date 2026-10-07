// Pure helpers shared by the manage page and the public viewer (and unit-tested from src/tools/countdown/lib.test.ts).

/** Splits a duration into whole days/hours/minutes/seconds. Negative durations clamp to zero (finished). */
export function parts(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(t / 86400), h: Math.floor((t % 86400) / 3600), m: Math.floor((t % 3600) / 60), s: t % 60, done: ms <= 0 };
}
const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
/** "3 days, 4 hours, 5 minutes and 6 seconds" (zero units skipped; for screen readers and previews). */
export function spoken(ms) {
  const p = parts(ms);
  if (p.done) return 'Finished';
  const u = [p.d && pl(p.d, 'day'), p.h && pl(p.h, 'hour'), p.m && pl(p.m, 'minute'), p.s && pl(p.s, 'second')].filter(Boolean);
  return u.length > 1 ? `${u.slice(0, -1).join(', ')} and ${u.at(-1)}` : (u[0] ?? 'Less than a second');
}
export const pad2 = (n) => String(n).padStart(2, '0');

/** Offset of `tz` from UTC at instant `t`, in ms (e.g. +36000000 for Australia/Sydney in winter). */
export function tzOffset(t, tz) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const o = Object.fromEntries(f.formatToParts(new Date(t)).map((p) => [p.type, p.value]));
  return Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour, +o.minute, +o.second) - Math.floor(t / 1000) * 1000;
}
/** "2026-12-31T23:59" wall-clock time in `tz` -> UTC epoch ms. Times skipped by a DST jump resolve forward. Returns NaN on bad input. */
export function zonedToUtc(local, tz) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local ?? '');
  if (!m) return NaN;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  if (new Date(guess).getUTCDate() !== +m[3] || +m[4] > 23) return NaN; // 2026-02-30, 24:00
  try {
    // Candidate offsets: the ones in force a day either side cover both sides of any DST change.
    const before = tzOffset(guess - 864e5, tz),
      offs = [before, tzOffset(guess, tz), tzOffset(guess + 864e5, tz)];
    const ok = offs.map((o) => guess - o).filter((t) => t + tzOffset(t, tz) === guess);
    return ok.length ? Math.min(...ok) : guess - before; // ambiguous (DST end): earlier; nonexistent (DST gap): shifted forward
  } catch {
    return NaN;
  }
}
/** UTC epoch ms -> "YYYY-MM-DDTHH:mm" wall-clock time in `tz` (for a datetime-local input). */
export function utcToZoned(t, tz) {
  const d = new Date(t + tzOffset(t, tz));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}
export function validTz(tz) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return !!tz;
  } catch {
    return false;
  }
}
/** "Thu, 31 Dec 2026, 23:59 AEDT" style label of instant `t` in `tz` (undefined = viewer's zone). */
export function when(t, tz, locale) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(t);
}

// ---- iCalendar (RFC 5545) ----
const icsText = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsTime = (t) =>
  new Date(t)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
/** Folds a content line to 75 octets per line (continuations start with a space), never splitting a UTF-8 character. */
export function fold(line) {
  const enc = new TextEncoder(),
    out = [];
  let cur = '',
    n = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (n + b > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      n = 0;
    }
    cur += ch;
    n += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}
/** A one-event calendar file. The event is a moment (no duration) at `target`, stored in UTC. */
export function ics({ id, title, target, message, url }, now = Date.now()) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//6o2f.dev//Countdown//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${id}@countdown.6o2f.dev`,
    `DTSTAMP:${icsTime(now)}`,
    `DTSTART:${icsTime(target)}`,
    `DTEND:${icsTime(target)}`,
    `SUMMARY:${icsText(title)}`,
    ...(message || url ? [`DESCRIPTION:${icsText([message, url].filter(Boolean).join('\n\n'))}`] : []),
    ...(url ? [`URL:${url}`] : []),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(title)}`,
    'TRIGGER:-PT15M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
export const slug = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'countdown';
