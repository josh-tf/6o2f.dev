import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { parse, describe, quantile, quartiles, histogram, sturges, fmt, sum } from '../../../public/_/stats/lib.js';

const near = (a: number, b: number, eps = 1e-5) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
// Anscombe's quartet
const x1 = [10, 8, 13, 9, 11, 14, 6, 4, 12, 7, 5];
const y1 = [8.04, 6.95, 7.58, 8.81, 8.33, 9.96, 7.24, 4.26, 10.84, 4.82, 5.68];
const y2 = [9.14, 8.14, 8.74, 8.77, 9.26, 8.1, 6.13, 3.1, 9.13, 7.26, 4.74];
const y3 = [7.46, 6.77, 12.74, 7.11, 7.81, 8.84, 6.08, 5.39, 8.15, 6.42, 5.73];

test('parse', () => {
  const r = parse('1, 2;3\n4\t5 abc $6 7% 1e3 -.5 n/a 1,5');
  assert.deepEqual(r.nums, [1, 2, 3, 4, 5, 6, 7, 1000, -0.5, 1, 5]);
  assert.deepEqual(r.skipped, ['abc', 'n/a']);
  assert.deepEqual(parse('').nums, []);
  assert.deepEqual(parse('Infinity NaN 0x10').skipped, ['Infinity', 'NaN', '0x10']);
});
test('Anscombe x: mean 9, variance 11', () => {
  const d = describe(x1);
  assert.equal(d.mean, 9);
  near(d.sampVar, 11);
  near(d.popVar, 10);
  near(d.sampSd, 3.316625);
  assert.equal(d.median, 9);
  assert.equal(d.sum, 99);
  assert.equal(d.range, 10);
  assert.deepEqual(d.modes, []);
});
test('Anscombe y1..y3 share mean 7.50 and variance 4.12', () => {
  for (const y of [y1, y2, y3]) {
    const d = describe(y);
    near(d.mean, 7.5, 0.002);
    near(d.sampVar, 4.125, 0.003);
  }
  near(describe(y1).sampVar, 4.127269, 1e-6);
});
test('quartile methods', () => {
  const s = [...x1].sort((a, b) => a - b);
  assert.deepEqual(quartiles(s, 'inclusive'), [6.5, 11.5]);
  assert.deepEqual(quartiles(s, 'exclusive'), [6, 12]);
  assert.deepEqual(quartiles(s, 'tukey'), [6, 12]);
  assert.deepEqual(quartiles([1, 2, 3, 4], 'tukey'), [1.5, 3.5]);
  near(quantile([1, 2, 3, 4], 0.25, 'exclusive'), 1.25);
  assert.equal(quantile([5], 0.9), 5);
});
test('outliers with 1.5 IQR (Anscombe y3)', () => {
  const d = describe(y3);
  near(d.q1, 6.25);
  near(d.q3, 7.98);
  near(d.iqr, 1.73);
  assert.deepEqual(d.outliers, [12.74]);
});
test('modes, skewness, kurtosis', () => {
  assert.deepEqual(describe([1, 2, 2, 3, 3, 4]).modes, [2, 3]);
  near(describe([1, 2, 3, 4, 10]).skew, 1.697056, 1e-5); // Excel SKEW
  near(describe([1, 2, 3, 4, 10]).kurt, 3.152, 1e-9); // Excel KURT: 1.25*1394/156.25 - 8
  assert.ok(Number.isNaN(describe([3, 3, 3]).skew));
  const one = describe([42]);
  assert.equal(one.mean, 42);
  assert.ok(Number.isNaN(one.sampVar));
  assert.equal(one.popVar, 0);
  assert.equal(describe([]), null);
});
test('sum keeps precision', () => {
  assert.equal(sum(Array(10).fill(0.1)), 1);
});
test('histogram', () => {
  const h = histogram([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3);
  assert.deepEqual(
    h.map((b: any) => b.count),
    [3, 3, 4],
  );
  assert.equal(h.at(-1).hi, 10);
  assert.deepEqual(histogram([5, 5], 4), [{ lo: 5, hi: 5, count: 2 }]);
  assert.equal(sturges(100), 8);
});
test('fmt', () => {
  assert.equal(fmt(7.500909090909), '7.500909091');
  assert.equal(fmt(1e20), '1e+20');
  assert.equal(fmt(NaN), '—');
  assert.equal(fmt(0), '0');
});
test('large input does not overflow the stack', () => {
  const nums = Array.from({ length: 300000 }, (_, i) => i % 1000);
  const d = describe(nums);
  assert.equal(d.n, 300000);
  assert.equal(d.modeCount, 300);
});
