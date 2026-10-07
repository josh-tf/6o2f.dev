import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { parse, parseISO, humanize, toISO, toClock, totals, split, round } from '../../../public/_/duration/lib.js';
const sec = (s: string, u?: string) => parse(s, u).seconds;

test('ISO 8601 parsing', () => {
  assert.equal(parseISO('PT1H30M').seconds, 5400);
  assert.equal(parseISO('P1DT2H3M4.5S').seconds, 93784.5);
  assert.equal(parseISO('P2W').seconds, 1209600);
  assert.equal(parseISO('PT0,5S').seconds, 0.5);
  assert.equal(parseISO('-PT10S').seconds, -10);
  assert.equal(parseISO('P1Y').seconds, 31556952);
  assert.equal(parseISO('P1Y2M3DT4H5M6S').nominal, true);
  for (const bad of ['P', 'PT', 'P1DT', 'P1H', 'PT1D', 'P1.5DT2H', '1H', 'P-1D']) assert.ok(parseISO(bad).error, bad);
});
test('natural phrases', () => {
  assert.equal(sec('90 minutes'), 5400);
  assert.equal(sec('2h30m'), 9000);
  assert.equal(sec('2 hrs, 30 mins'), 9000);
  assert.equal(sec('1.5 days'), 129600);
  assert.equal(sec('a week and 3 days'), 864000);
  assert.equal(sec('a week and three days'), 864000);
  assert.equal(sec('week and 3 days'), 864000);
  assert.equal(sec('an hour and a half'), 5400);
  assert.equal(sec('2 hours and a half'), 9000);
  assert.equal(sec('half an hour'), 1800);
  assert.equal(sec('a quarter of an hour'), 900);
  assert.equal(sec('1 fortnight'), 1209600);
  assert.equal(sec('-3h'), -10800);
  assert.equal(sec('5 minutes ago'), -300);
  assert.equal(sec('250ms'), 0.25);
  assert.equal(sec('1,000 minutes'), 60000);
  assert.equal(sec('PT90M'), 5400);
  assert.equal(sec('1 month'), 2629746);
  assert.equal(sec('twenty-five minutes'), 1500);
  assert.equal(sec('forty five seconds'), 45);
  assert.equal(sec('fifteen minutes'), 900);
  assert.ok(parse('3 months').nominal);
});
test('clock text and plain numbers', () => {
  assert.equal(sec('1:30:15'), 5415);
  assert.equal(sec('90:00'), 5400);
  assert.equal(sec('1:02:03:04'), 93784);
  assert.equal(sec('0:00:01.250'), 1.25);
  assert.equal(sec('3600'), 3600);
  assert.equal(sec('1500', 'milliseconds'), 1.5);
  assert.equal(sec('2.5', 'hours'), 9000);
  assert.ok(parse('1:75').error);
});
test('invalid input gives a message', () => {
  for (const bad of ['', 'banana', '5', '5 parsecs', '2h30', 'h h', '3 # 4', '1e999']) {
    const r = parse(bad);
    if (bad === '5') {
      assert.equal(r.seconds, 5);
      continue;
    }
    assert.ok(r.error, `expected error for "${bad}"`);
  }
});
test('humanize, ISO, clock', () => {
  assert.equal(humanize(93784.5), '1 day, 2 hours, 3 minutes and 4.5 seconds');
  assert.equal(humanize(93784.5, 'hours'), '26 hours, 3 minutes and 4.5 seconds');
  assert.equal(humanize(864000, 'weeks'), '1 week and 3 days');
  assert.equal(humanize(0), '0 seconds');
  assert.equal(humanize(-60), 'minus 1 minute');
  assert.equal(humanize(0.001), '0.001 seconds');
  assert.equal(toISO(93784.5), 'P1DT2H3M4.5S');
  assert.equal(toISO(93784.5, 'hours'), 'PT26H3M4.5S');
  assert.equal(toISO(86400), 'P1D');
  assert.equal(toISO(0), 'PT0S');
  assert.equal(toISO(-90), '-PT1M30S');
  assert.equal(toClock(93784.5), '26:03:04.5');
  assert.equal(toClock(59.999), '0:00:59.999');
  assert.equal(toClock(-5), '-0:00:05');
  assert.deepEqual(split(0.1 + 0.2, 'days'), [['seconds', 0.3]]);
  assert.equal(round(1.0005 * 3, 3), 3.002);
  // ISO round trip
  for (const s of [1, 59.5, 3600, 93784.5, 1209600 + 7]) assert.equal(parseISO(toISO(s)).seconds, s);
  const t = Object.fromEntries(totals(5400));
  assert.equal(t.minutes, 90);
  assert.equal(t.hours, 1.5);
  assert.equal(t.milliseconds, 5400000);
});
