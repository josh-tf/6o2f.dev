import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { allocate, split, toMinor, fmt, digitsOf } from '../../../public/_/tip/lib.js';

test('allocate distributes the remainder and always sums', () => {
  assert.deepEqual(allocate(100, [1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(allocate(1, [1, 1, 1]), [1, 0, 0]);
  assert.deepEqual(allocate(10000, [2, 1, 1]), [5000, 2500, 2500]);
  assert.deepEqual(allocate(0, [1, 2]), [0, 0]);
  assert.deepEqual(allocate(100, [0, 1]), [0, 100]);
  for (let t = 0; t < 400; t += 7)
    for (const w of [
      [1, 1, 1],
      [3, 2, 2],
      [1, 1.5, 0.25, 4],
    ])
      assert.equal(
        allocate(t, w).reduce((a: number, b: number) => a + b, 0),
        t,
      );
});
test('simple tip and even split', () => {
  const r = split({ bill: 12000, tipPct: 18, weights: [1, 1, 1, 1] });
  assert.equal(r.tip, 2160);
  assert.equal(r.total, 14160);
  assert.deepEqual(
    r.people.map((p: any) => p.total),
    [3540, 3540, 3540, 3540],
  );
});
test('remainder cents are shared out and the people add up to the total', () => {
  const r = split({ bill: 10000, tipPct: 15, weights: [1, 1, 1] });
  assert.equal(r.total, 11500);
  assert.deepEqual(
    r.people.map((p: any) => p.total),
    [3834, 3833, 3833],
  );
});
test('remainders do not stack on one person (100 + 20% over 3 = 40 each)', () => {
  const r = split({ bill: 10000, tipPct: 20, weights: [1, 1, 1] });
  assert.deepEqual(
    r.people.map((p: any) => p.total),
    [4000, 4000, 4000],
  );
  assert.equal(
    r.people.reduce((a: number, p: any) => a + p.tip, 0),
    2000,
  );
  assert.deepEqual(
    split({ bill: 10001, tipPct: 20, weights: [1, 1, 1] }).people.map((p: any) => p.total),
    [4001, 4000, 4000],
  );
});
test('uneven shares', () => {
  const r = split({ bill: 10000, tipPct: 20, weights: [2, 1, 1] });
  assert.deepEqual(
    r.people.map((p: any) => p.total),
    [6000, 3000, 3000],
  );
});
test('tax included, tip on pre-tax amount', () => {
  const r = split({ bill: 11000, taxPct: 10, taxIncluded: true, tipPct: 20, weights: [1] });
  assert.equal(r.tax, 1000);
  assert.equal(r.subtotal, 10000);
  assert.equal(r.tip, 2000);
  assert.equal(r.total, 13000);
});
test('tax added on top, tip on total with tax', () => {
  const r = split({ bill: 10000, taxPct: 10, taxIncluded: false, tipOnPreTax: false, tipPct: 20, weights: [1] });
  assert.equal(r.tax, 1000);
  assert.equal(r.tip, 2200);
  assert.equal(r.total, 13200);
});
test('round up per person turns the difference into tip', () => {
  const r = split({ bill: 10000, tipPct: 15, weights: [1, 1, 1], roundUp: true });
  assert.deepEqual(
    r.people.map((p: any) => p.total),
    [3900, 3900, 3900],
  );
  assert.equal(r.total, 11700);
  assert.equal(r.tip, 1700);
  assert.equal(
    r.people.reduce((a: number, p: any) => a + p.tip + p.base, 0),
    r.total,
  );
  assert.equal(split({ bill: 0, roundUp: true }).total, 0);
});
test('zero-decimal currencies', () => {
  assert.equal(digitsOf('JPY', 'en'), 0);
  assert.equal(digitsOf('USD', 'en'), 2);
  assert.equal(toMinor(1234, 0), 1234);
  assert.equal(toMinor(12.34, 2), 1234);
  assert.equal(toMinor(1.005, 2), 101);
  assert.equal(fmt(1234, 'JPY', 'en'), '¥1,234');
  assert.equal(fmt(123456, 'USD', 'en-US'), '$1,234.56');
});
test('validation', () => {
  for (const b of [{ bill: -1 }, { bill: NaN }, { tipPct: -5 }, { taxPct: 101 }, { weights: [] }, { weights: [0, 0] }, { weights: [-1, 2] }])
    assert.ok(split({ bill: 100, ...b }).error, JSON.stringify(b));
});
test('negative shares get their own message', () => {
  assert.equal(split({ bill: 1000, weights: [1, -1] }).error, 'Shares must be zero or more.');
  // independent: 186.40 incl. 10% GST, 15% tip on pre-tax over 4
  const r = split({ bill: 18640, tipPct: 15, taxPct: 10, taxIncluded: true, weights: [1, 1, 1, 1] });
  assert.equal(r.tax, 1695);
  assert.equal(r.subtotal, 16945);
  assert.equal(r.tip, 2542);
  assert.equal(r.total, 21182);
  assert.deepEqual(
    r.people.map((p: any) => p.total),
    [5296, 5296, 5295, 5295],
  );
});
