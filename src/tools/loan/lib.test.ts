import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { calc, csv, money, addPeriods, toCents, span } from '../../../public/_/loan/lib.js';

const base = { principal: 300000, rate: 6, years: 30, months: 0, freq: 'monthly', extra: 0, ioMonths: 0, balloon: 0, start: '2026-01-31' };

test('300000 at 6% over 30 years', () => {
  const r = calc(base);
  assert.equal(r.payment, 179865);
  assert.equal(r.scheduled, 360);
  assert.equal(r.rows.at(-1).balance, 0);
  assert.ok(Math.abs(r.totalInterest - 34751400) < 400, String(r.totalInterest)); // 347,514.57 +- rounding
  assert.equal(r.totalPaid, r.principal + r.totalInterest);
  assert.equal(r.payoffDate, '2056-01-31');
  assert.equal(
    r.rows.reduce((s: number, x: any) => s + x.principal, 0),
    30000000,
  );
});
test('first row', () => {
  const r = calc(base).rows[0];
  assert.equal(r.interest, 150000);
  assert.equal(r.principal, 29865);
  assert.equal(r.date, '2026-02-28');
});
test('zero rate', () => {
  const r = calc({ ...base, rate: 0, years: 1 });
  assert.equal(r.payment, 2500000);
  assert.equal(r.totalInterest, 0);
});
test('weekly and fortnightly periods', () => {
  assert.equal(calc({ ...base, freq: 'weekly', years: 25 }).periods, 1300);
  assert.equal(calc({ ...base, freq: 'fortnightly', years: 25 }).periods, 650);
  assert.equal(addPeriods('2026-01-01', 'fortnightly', 2), '2026-01-29');
});
test('extra repayments shorten the loan and save interest', () => {
  const r = calc({ ...base, extra: 200 });
  assert.ok(r.scheduled < 360 && r.savedInterest > 0 && r.savedPeriods > 0);
  assert.equal(r.rows.at(-1).balance, 0);
  assert.equal(
    r.rows.reduce((s: number, x: any) => s + x.principal, 0),
    30000000,
  );
});
test('interest only period', () => {
  const r = calc({ ...base, years: 10, ioMonths: 24 });
  assert.equal(r.ioPayment, 150000);
  assert.ok(r.rows.slice(0, 24).every((x: any) => x.principal === 0 && x.balance === 30000000));
  assert.equal(r.rows.at(-1).balance, 0);
});
test('balloon is paid with the last repayment', () => {
  const r = calc({ ...base, years: 5, balloon: 100000 });
  assert.equal(r.rows.length, 60);
  assert.ok(r.finalPayment > r.payment + 9900000);
  assert.equal(r.rows.at(-1).balance, 0);
  assert.ok(r.rows[58].balance > 9900000 && r.rows[58].balance < 10400000);
});
test('validation', () => {
  for (const bad of [
    { principal: 0 },
    { rate: -1 },
    { rate: 101 },
    { years: 0 },
    { balloon: 300000 },
    { ioMonths: 360 },
    { freq: 'daily' },
    { years: 101, freq: 'weekly' },
  ])
    assert.ok(calc({ ...base, ...bad }).error, JSON.stringify(bad));
});
test('formatting', () => {
  assert.equal(money(179865), '$1,798.65');
  assert.equal(money(5), '$0.05');
  assert.equal(money(-123456789), '-$1,234,567.89');
  assert.equal(toCents(19.99), 1999);
  assert.equal(toCents(1.005), 101);
  assert.equal(span(360, 'monthly'), '30 years');
  assert.equal(span(26 * 2 + 13, 'fortnightly'), '2 years 6 months');
  const c = csv(calc({ ...base, years: 1 }).rows).split('\n');
  assert.equal(c.length, 13);
  assert.match(c[1], /^1,2026-02-28,\d+\.\d\d,0\.00,/);
});
test('short spans and limits', () => {
  assert.equal(span(1, 'fortnightly'), '1 fortnight');
  assert.equal(span(2, 'weekly'), '2 weeks');
  assert.ok(calc({ ...base, principal: 2e10 }).error);
  // independent check: 30000 at 7% over 5 years with a 10000 balloon = 454.36 a month, final 10454.17
  const b = calc({ ...base, principal: 30000, rate: 7, years: 5, balloon: 10000 });
  assert.equal(b.payment, 45436);
  assert.equal(b.finalPayment, 1045417);
  // interest-only 2 years on 100000 at 5%, then 8 years amortising = 416.67 then 1265.99
  const io = calc({ ...base, principal: 100000, rate: 5, years: 10, ioMonths: 24 });
  assert.equal(io.ioPayment, 41667);
  assert.equal(io.payment, 126599);
});
