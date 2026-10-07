import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore no types for the browser module
import { parse, relative, toLocalInput } from '../../../public/_/time/lib.js';

test('parse epochs', () => {
  assert.deepEqual([parse('1700000000')!.kind, +parse('1700000000')!.date], ['seconds', 1.7e12]);
  assert.deepEqual([parse('1700000000000')!.kind, +parse('1700000000000')!.date], ['milliseconds', 1.7e12]);
  assert.equal(+parse('1700000000.5')!.date, 1700000000500);
  assert.equal(+parse('-86400')!.date, -86400000);
  assert.equal(+parse(' 0 ')!.date, 0);
  assert.deepEqual([parse('1700000000123456')!.kind, +parse('1700000000123456')!.date], ['microseconds', 1700000000123]);
  assert.deepEqual([parse('1700000000123456789')!.kind, Math.floor(+parse('1700000000123456789')!.date)], ['nanoseconds', 1700000000123]);
});
test('parse strings and junk', () => {
  assert.equal(parse('2023-11-14T22:13:20Z')!.date.toISOString(), '2023-11-14T22:13:20.000Z');
  assert.equal(parse('2023-11-14T22:13:20Z')!.kind, 'date string');
  assert.equal(parse('nope'), null);
  assert.equal(parse(''), null);
  assert.equal(parse('99999999999999999999'), null);
});
test('relative', () => {
  const now = 1.7e12;
  assert.equal(relative(new Date(now - 3 * 3600e3), now), '3 hours ago');
  assert.equal(relative(new Date(now + 2 * 86400e3), now), 'in 2 days');
  assert.equal(relative(new Date(now - 1000), now), 'just now');
  assert.equal(relative(new Date(now - 400 * 86400e3), now), '1 year ago');
  assert.equal(relative(new Date(now + 90e3), now), 'in 1 minute');
});
test('toLocalInput', () => assert.match(toLocalInput(new Date(1.7e12)), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/));
