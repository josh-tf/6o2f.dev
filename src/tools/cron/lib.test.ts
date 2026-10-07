import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { parse, nextRuns, explain, until } from '../../../public/_/cron/lib.js';

const iso = (expr: string, from: string, n = 3) => nextRuns(parse(expr), new Date(from), n, true).map((d: Date) => d.toISOString().slice(0, 16));

test('errors name the field', () => {
  assert.throws(() => parse('61 * * * *'), /minute.*outside 0-59/);
  assert.throws(() => parse('* 24 * * *'), /hour/);
  assert.throws(() => parse('* * 0 * *'), /day-of-month/);
  assert.throws(() => parse('* * * 13 *'), /month/);
  assert.throws(() => parse('* * * * FUN'), /day-of-week.*FUN/);
  assert.throws(() => parse('* * * 5-2 *'), /backwards/);
  assert.throws(() => parse('*/0 * * * *'), /step/);
  assert.throws(() => parse('* * *'), /Expected 5 fields/);
  assert.throws(() => parse('@sometimes'), /Unknown/);
});
test('steps, lists, ranges, names', () => {
  assert.deepEqual(iso('*/20 * * * *', '2026-01-01T00:00:00Z'), ['2026-01-01T00:20', '2026-01-01T00:40', '2026-01-01T01:00']);
  assert.deepEqual(iso('0 9-10,17 * * MON-FRI', '2026-10-09T09:30:00Z'), ['2026-10-09T10:00', '2026-10-09T17:00', '2026-10-12T09:00']); // Fri 9 Oct 2026
  assert.deepEqual(iso('0 0 1 JAN,jul *', '2026-02-01T00:00:00Z', 2), ['2026-07-01T00:00', '2027-01-01T00:00']);
  assert.deepEqual(iso('5/30 0 * * *', '2026-01-01T00:00:00Z', 2), ['2026-01-01T00:05', '2026-01-01T00:35']);
  assert.deepEqual(iso('@hourly', '2026-01-01T00:00:00Z', 1), ['2026-01-01T01:00']);
  assert.deepEqual(iso('0 0 * * 7', '2026-10-07T00:00:00Z', 1), ['2026-10-11T00:00']); // 7 = Sunday
});
test('month lengths and leap days', () => {
  assert.deepEqual(iso('0 0 31 * *', '2026-01-31T00:00:00Z', 3), ['2026-03-31T00:00', '2026-05-31T00:00', '2026-07-31T00:00']);
  assert.deepEqual(iso('0 0 29 2 *', '2026-01-01T00:00:00Z', 2), ['2028-02-29T00:00', '2032-02-29T00:00']);
  assert.deepEqual(iso('0 0 30 2 *', '2026-01-01T00:00:00Z'), []);
});
test('dom/dow OR semantics', () => {
  // 13th OR any Friday
  assert.deepEqual(iso('0 0 13 * FRI', '2026-10-01T00:00:00Z', 4), ['2026-10-02T00:00', '2026-10-09T00:00', '2026-10-13T00:00', '2026-10-16T00:00']);
  // star in one field = AND (only Fridays)
  assert.deepEqual(iso('0 0 * * FRI', '2026-10-01T00:00:00Z', 2), ['2026-10-02T00:00', '2026-10-09T00:00']);
  assert.deepEqual(iso('0 0 */2 * FRI', '2026-10-01T00:00:00Z', 2), ['2026-10-09T00:00', '2026-10-23T00:00']);
});
test('explain', () => {
  assert.equal(explain(parse('30 9 * * MON-FRI')), 'At 09:30 on Monday through Friday');
  assert.equal(explain(parse('*/15 * * * *')), 'Every 15 minutes');
  assert.equal(explain(parse('0 0 1 JAN *')), 'At 00:00 on day-of-month 1 in January');
  assert.equal(explain(parse('0 9,17 * * *')), 'At 09:00 and 17:00');
  assert.equal(explain(parse('0,30 8-18 * * *')), 'At minute 0 and 30 past hour 8 through 18');
  assert.equal(explain(parse('0 0 13 * FRI')), 'At 00:00 on day-of-month 13 or Friday');
});
test('local zone: DST gap and fall-back still progress', () => {
  const old = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    const r = nextRuns(parse('30 2 * * *'), new Date('2026-03-07T12:00:00Z'), 3, false);
    assert.equal(r.length, 3);
    const f = nextRuns(parse('30 1 * * *'), new Date('2026-10-31T12:00:00Z'), 3, false);
    assert.equal(f.length, 3);
    assert.ok(f[1] > f[0] && f[2] > f[1]);
  } finally {
    process.env.TZ = old;
  }
});

test('explain wording for steps and bare minutes', () => {
  assert.equal(explain(parse('30 * * * *')), 'At minute 30 of every hour');
  assert.equal(explain(parse('@hourly')), 'At minute 0 of every hour');
  assert.equal(explain(parse('5-10/2 1-3 * * *')), 'Every 2 minutes from 5 through 10 past hour 1 through 3');
  assert.equal(explain(parse('0 0 */2 * *')), 'At 00:00 on every 2 days');
});
test('until', () => {
  const t = new Date('2026-01-01T00:00:00Z'),
    at = (ms: number) => new Date(t.getTime() + ms);
  assert.equal(until(at(20e3), t), 'in under a minute');
  assert.equal(until(at(5 * 6e4), t), 'in 5 min');
  assert.equal(until(at(125 * 6e4), t), 'in 2 h 5 min');
  assert.equal(until(at((2 * 1440 + 185) * 6e4), t), 'in 2 d 3 h');
  assert.equal(until(at(1440 * 6e4), t), 'in 1 d');
});
