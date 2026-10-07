import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { round, fmt, pctOf, whatPct, change, adjust, original, points, stack } from '../../../public/_/percent/lib.js';

test('rounding', () => {
  assert.equal(round(1.005, 2), 1.01);
  assert.equal(round(2.675, 2), 2.68);
  assert.equal(round(-2.5, 0), -3);
  assert.equal(round(0.1 * 3, 10), 0.3);
  assert.equal(round(-0.001, 2), 0);
  assert.equal(round(1e-7, 2), 0);
  assert.equal(round(123456.789, 1), 123456.8);
  assert.equal(round(1e20, 2), 1e20);
  assert.equal(fmt(1234567.891, 2), '1,234,567.89');
});
test('X% of Y and X is what % of Y', () => {
  assert.equal(pctOf(20, 150).value, 30);
  assert.equal(round(pctOf(17.5, 80).value, 2), 14);
  assert.equal(pctOf(-10, 50).value, -5);
  assert.equal(pctOf(0, 50).value, 0);
  assert.equal(whatPct(30, 150).value, 20);
  assert.equal(round(whatPct(1, 3).value, 4), 33.3333);
  assert.equal(whatPct(-5, 20).value, -25);
  assert.ok(whatPct(5, 0).error);
  assert.ok(pctOf(NaN, 3).error);
});
test('percent change', () => {
  assert.equal(change(50, 75).value, 50);
  assert.equal(change(75, 50).word, 'decrease');
  assert.equal(round(change(75, 50).value, 2), -33.33);
  assert.equal(change(-100, -50).value, 50); // relative to |A|: moving up from -100 to -50 is +50%
  assert.equal(change(-50, 50).value, 200);
  assert.ok(change(0, 5).error);
  assert.ok(change(0, 0).error);
});
test('increase/decrease and reverse', () => {
  assert.equal(round(adjust(80, 25).value, 2), 100);
  assert.equal(round(adjust(80, 25, -1).value, 2), 60);
  assert.equal(round(adjust(80, 25, -1).delta, 2), -20);
  assert.equal(round(original(115, 15).value, 2), 100);
  assert.equal(round(original(60, 25, -1).value, 2), 80);
  assert.equal(round(original(110, 10).value, 10), 100);
  assert.ok(original(10, 100, -1).error);
  assert.ok(original(10, 150, -1).error);
});
test('percentage points vs percent', () => {
  const r = points(4, 5);
  assert.equal(r.value, 1);
  assert.equal(r.rel, 25);
  assert.equal(points(0, 3).rel, null);
  assert.equal(round(points(10, 7.5).rel, 2), -25);
});
test('stacked discounts', () => {
  const r = stack(20, 10, 100);
  assert.equal(round(r.value, 6), 28);
  assert.equal(round(r.final, 6), 72);
  assert.equal(stack(50, 50).value, 75);
  assert.equal(stack(10, 0).final, null);
  assert.equal(round(stack(-10, 10).value, 6), 1); // a 10% surcharge then 10% off: 1% below the start
  assert.ok(stack(120, 10).error);
});
