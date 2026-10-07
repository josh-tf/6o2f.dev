import test from 'node:test';
import assert from 'node:assert/strict';
process.env.TZ = 'America/New_York'; // DST: 2026-03-08 02:00 -> 03:00, 2026-11-01 02:00 -> 01:00
// @ts-ignore browser module
import {
  parse,
  isoDate,
  isoDateTime,
  add,
  diff,
  isoWeek,
  isoWeekString,
  dayOfYear,
  isLeap,
  businessDays,
  parseHolidays,
  age,
  toMs,
  weekdayName,
} from '../../../public/_/date/lib.js';
const P = (s: string) => parse(s)!;

test('parse and validate', () => {
  assert.deepEqual(parse('2026-02-28T13:05'), { y: 2026, m: 2, d: 28, h: 13, mi: 5 });
  assert.equal(parse('2026-02-29'), null);
  assert.equal(parse('2026-13-01'), null);
  assert.equal(parse('nope'), null);
  assert.equal(isoDate(P('0050-03-01')), '0050-03-01');
});
test('month-end clamping and leap day', () => {
  assert.equal(isoDate(add(P('2026-01-31'), { months: 1 })), '2026-02-28');
  assert.equal(isoDate(add(P('2024-01-31'), { months: 1 })), '2024-02-29');
  assert.equal(isoDate(add(P('2024-02-29'), { years: 1 })), '2025-02-28');
  assert.equal(isoDate(add(P('2024-02-29'), { years: 4 })), '2028-02-29');
  assert.equal(isoDate(add(P('2026-03-31'), { months: -1 })), '2026-02-28');
  assert.equal(isoDate(add(P('2026-05-31'), { months: 1, days: 1 })), '2026-07-01');
  assert.equal(isoDate(add(P('2026-01-01'), { weeks: 2, days: -1 })), '2026-01-14');
  assert.equal(isoDate(add(P('2026-12-31'), { days: 1 })), '2027-01-01');
  assert.ok(isLeap(2000) && isLeap(2024) && !isLeap(1900) && !isLeap(2026));
});
test('DST: days keep the clock time, hours are elapsed time', () => {
  assert.equal(isoDateTime(add(P('2026-03-07T12:00'), { days: 1 })), '2026-03-08T12:00');
  assert.equal(isoDateTime(add(P('2026-03-07T12:00'), { hours: 24 })), '2026-03-08T13:00');
  assert.equal(isoDateTime(add(P('2026-03-07T12:00'), { hours: 24 }, true)), '2026-03-08T12:00');
  assert.equal(isoDateTime(add(P('2026-11-01T00:30'), { hours: 2 })), '2026-11-01T01:30');
  const a = P('2026-03-08T00:00'),
    b = P('2026-03-09T00:00');
  assert.equal((toMs(b, false) - toMs(a, false)) / 3600000, 23);
  assert.equal((toMs(b, true) - toMs(a, true)) / 3600000, 24);
});
test('difference', () => {
  assert.deepEqual(diff(P('2020-02-29'), P('2026-10-07')), { sign: 1, years: 6, months: 7, days: 8, hours: 0, minutes: 0 });
  assert.deepEqual(diff(P('2026-01-31'), P('2026-03-01')), { sign: 1, years: 0, months: 1, days: 1, hours: 0, minutes: 0 });
  assert.deepEqual(diff(P('2026-03-01T10:30'), P('2026-01-31T08:00')), { sign: -1, years: 0, months: 1, days: 1, hours: 2, minutes: 30 });
  assert.equal(diff(P('2026-05-05'), P('2026-05-05')).sign, 0);
  for (const [x, y] of [
    ['2023-01-31', '2024-02-29'],
    ['2024-02-29', '2025-03-01'],
    ['2026-08-30T22:15', '2027-02-28T03:00'],
  ]) {
    const r = diff(P(x), P(y));
    assert.equal(isoDateTime(add(P(x), { months: r.years * 12 + r.months, days: r.days, hours: r.hours + r.minutes / 60 }, true)), isoDateTime(P(y)));
  }
});
test('ISO weeks at year edges', () => {
  assert.equal(isoWeekString(P('2026-01-01')), '2026-W01-4');
  assert.equal(isoWeekString(P('2027-01-01')), '2026-W53-5');
  assert.equal(isoWeekString(P('2027-01-04')), '2027-W01-1');
  assert.equal(isoWeekString(P('2024-12-30')), '2025-W01-1');
  assert.equal(isoWeekString(P('2021-01-03')), '2020-W53-7');
  assert.equal(isoWeekString(P('2008-12-29')), '2009-W01-1');
  assert.deepEqual(isoWeek(P('2026-10-07')), { year: 2026, week: 41, weekday: 3 });
  assert.equal(weekdayName(P('2026-10-07')), 'Wednesday');
  assert.equal(dayOfYear(P('2024-12-31')), 366);
  assert.equal(dayOfYear(P('2026-03-01')), 60);
});
test('business days and holidays', () => {
  assert.deepEqual(businessDays(P('2026-10-05'), P('2026-10-12')), { days: 5, holidays: 0 });
  assert.deepEqual(businessDays(P('2026-10-03'), P('2026-10-05')), { days: 0, holidays: 0 });
  const h = parseHolidays('2026-12-25 Christmas\n2026-12-26, 2026-12-28\n2026-02-30');
  assert.equal(h.set.size, 3);
  assert.deepEqual(h.bad, ['2026-02-30']);
  assert.deepEqual(businessDays(P('2026-12-21'), P('2027-01-04'), h.set), { days: 8, holidays: 2 });
  assert.equal(businessDays(P('2026-10-12'), P('2026-10-05')).days, -5);
  // the week-skipping count matches a day-by-day count over many spans, holidays on weekends are not double-counted
  const hs = parseHolidays('2026-01-01 2026-01-03 2026-04-03 2026-12-25 2027-01-01').set;
  for (let i = 0; i < 400; i += 7)
    for (const len of [0, 1, 5, 6, 7, 13, 30, 366]) {
      const a = add(P('2025-12-20'), { days: i }),
        b = add(a, { days: len });
      let n = 0;
      for (let x = 0; x < len; x++) {
        const d = add(a, { days: x }),
          wd = isoWeek(d).weekday;
        if (wd < 6 && !hs.has(Math.round(toMs(d, true) / 864e5))) n++;
      }
      assert.equal(businessDays(a, b, hs).days, n, `${isoDate(a)} +${len}`);
    }
  assert.equal(businessDays(P('0001-01-01'), P('9999-12-31')).days, 2608614); // 3652058 days = 521722 weeks (x5) + 4 days (Mon-Thu)
});
test('age', () => {
  assert.deepEqual(age(P('1990-10-08'), P('2026-10-07')), {
    years: 35,
    months: 11,
    days: 29,
    totalDays: 13148,
    nextIn: 1,
    nextWeekday: 'Thursday',
    nextAge: 36,
  });
  const leap = age(P('2000-02-29'), P('2027-02-28'))!;
  assert.equal(leap.years, 27);
  assert.equal(leap.nextIn, 0);
  assert.equal(age(P('2030-01-01'), P('2026-01-01')), null);
});
