import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore no types for the browser module
import { calc, fmt } from '../../../public/_/calc/lib.js';

test('precedence and associativity', () => {
  assert.equal(calc('1+2*3'), 7);
  assert.equal(calc('(1+2)*3'), 9);
  assert.equal(calc('10-4-3'), 3);
  assert.equal(calc('100/10/2'), 5);
  assert.equal(calc('2^3^2'), 512);
  assert.equal(calc('2*3^2'), 18);
  assert.equal(calc('10%4'), 2);
  assert.equal(calc('1+10%4*2'), 5);
});
test('unary minus', () => {
  assert.equal(calc('-2^2'), -4);
  assert.equal(calc('2^-1'), 0.5);
  assert.equal(calc('--3'), 3);
  assert.equal(calc('2*-3'), -6);
  assert.equal(calc('-(1+2)'), -3);
  assert.equal(calc('+5'), 5);
});
test('constants, functions, ans', () => {
  assert.equal(calc('pi'), Math.PI);
  assert.equal(calc('e^1'), Math.E);
  assert.equal(calc('sqrt(16)+abs(-2)'), 6);
  assert.equal(calc('max(1,5,3)'), 5);
  assert.equal(calc('min(4,2)'), 2);
  assert.equal(calc('round(2.5)+floor(1.9)+ceil(1.1)'), 6);
  assert.equal(calc('ln(e)'), 1);
  assert.equal(calc('log(1000)'), 3);
  assert.equal(calc('exp(0)'), 1);
  assert.ok(Math.abs(calc('sin(pi/2)') - 1) < 1e-12);
  assert.equal(calc('ans*2', 21), 42);
  assert.equal(calc('1e3+2.5e-1'), 1000.25);
  assert.equal(calc('SQRT(4)'), 2);
});
test('percent', () => {
  assert.equal(calc('20% of 150'), 30);
  assert.equal(calc('50 % of 8 + 1'), 5);
  assert.equal(calc('5%'), 0.05);
  assert.equal(calc('max(5%, 1%)'), 0.05);
  assert.equal(calc('(200)%'), 2);
  assert.equal(calc('7 % 4'), 3);
});
test('errors', () => {
  const bad = (s: string, re: RegExp) => assert.throws(() => calc(s), re);
  bad('1/0', /Division by zero/);
  bad('5%0', /Division by zero/);
  bad('', /Empty/);
  bad('1+', /Unexpected end/);
  bad('(1+2', /Missing "\)"/);
  bad('1+2)', /Unexpected "\)"/);
  bad('foo', /Unknown name "foo"/);
  bad('1 $ 2', /Unexpected "\$"/);
  bad('sqrt()', /needs an argument/);
  bad('min()', /needs an argument/);
  bad('sqrt(-1)', /not a number/);
  bad('ln(0)', /too large/);
  bad('10^400', /too large/);
  bad('2 3', /Unexpected "3"/);
});
test('fmt', () => {
  assert.equal(fmt(0.1 + 0.2), '0.3');
  assert.equal(fmt(1 / 3), '0.333333333333');
  assert.equal(fmt(1e21), '1e21');
  assert.equal(fmt(1234567890123), '1234567890123');
  assert.equal(fmt(123456789012345680), '1.23456789012e17');
  assert.equal(fmt(-2.5e-7), '-2.5e-7');
  assert.equal(fmt(calc('sin(pi)')), '0');
  assert.equal(fmt(calc('cos(pi/2)')), '0');
});
