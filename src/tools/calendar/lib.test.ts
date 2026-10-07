import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { isoWeek, isoWeekday, isoWeekDate, weeksInYear, dayOfYear, monthRows, parse, iso, isLeap } from '../../../public/_/calendar/lib.js';
const f = (s: string) => parse(s)!;

test('ISO weeks for 2020, 2026, 2027 and year boundaries', () => {
  assert.equal(weeksInYear(2020), 53);
  assert.equal(weeksInYear(2026), 53);
  assert.equal(weeksInYear(2027), 52);
  assert.equal(weeksInYear(2021), 52);
  assert.equal(isoWeekDate(f('2019-12-30')), '2020-W01-1');
  assert.equal(isoWeekDate(f('2020-01-01')), '2020-W01-3');
  assert.equal(isoWeekDate(f('2020-12-31')), '2020-W53-4');
  assert.equal(isoWeekDate(f('2021-01-03')), '2020-W53-7');
  assert.equal(isoWeekDate(f('2021-01-04')), '2021-W01-1');
  assert.equal(isoWeekDate(f('2026-01-01')), '2026-W01-4');
  assert.equal(isoWeekDate(f('2025-12-29')), '2026-W01-1');
  assert.equal(isoWeekDate(f('2026-12-31')), '2026-W53-4');
  assert.equal(isoWeekDate(f('2027-01-03')), '2026-W53-7');
  assert.equal(isoWeekDate(f('2027-01-04')), '2027-W01-1');
  assert.equal(isoWeekDate(f('2027-12-31')), '2027-W52-5');
  assert.equal(isoWeekDate(f('2028-01-02')), '2027-W52-7');
  assert.equal(isoWeekDate(f('2028-01-03')), '2028-W01-1');
  assert.deepEqual(isoWeek(f('2026-10-07')), { year: 2026, week: 41 });
  assert.equal(isoWeekday(f('1900-01-01')), 1);
  assert.equal(isoWeekday(f('0001-01-01')), 1);
});
test('day of year and leap years', () => {
  assert.equal(dayOfYear(f('2020-12-31')), 366);
  assert.equal(dayOfYear(f('2026-12-31')), 365);
  assert.equal(dayOfYear(f('2026-02-01')), 32);
  assert.ok(isLeap(2000) && !isLeap(2100));
  assert.equal(parse('2026-02-29'), null);
  assert.equal(iso(f('0099-01-05')), '0099-01-05');
});
test('month grids', () => {
  const jan26 = monthRows(2026, 1, 1); // 1 Jan 2026 is a Thursday
  assert.equal(jan26.length, 5);
  assert.deepEqual(
    jan26[0].days.map((d: any) => d && d.d),
    [null, null, null, 1, 2, 3, 4],
  );
  assert.equal(jan26[0].week, 1);
  assert.equal(jan26[4].week, 5);
  const sun = monthRows(2026, 1, 0);
  assert.deepEqual(
    sun[0].days.map((d: any) => d && d.d),
    [null, null, null, null, 1, 2, 3],
  );
  assert.equal(sun[0].week, 1); // the row's Monday is 29 Dec 2025 = 2026-W01
  const feb26 = monthRows(2026, 2, 1); // 1 Feb 2026 is a Sunday: 6 blanks
  assert.equal(feb26.length, 5);
  assert.equal(feb26[0].days[6].d, 1);
  const feb15 = monthRows(2010, 2, 1); // starts Monday, 28 days: exactly 4 rows
  assert.equal(feb15.length, 4);
  const dec26 = monthRows(2026, 12, 1);
  assert.equal(dec26.at(-1).week, 53);
  const jan21 = monthRows(2021, 1, 1);
  assert.equal(jan21[0].week, 53); // 1-3 Jan 2021 belong to 2020-W53
  for (let m = 1; m <= 12; m++)
    for (const ws of [0, 1])
      assert.equal(
        monthRows(2027, m, ws)
          .flatMap((r: any) => r.days)
          .filter(Boolean).length,
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1],
      );
});
