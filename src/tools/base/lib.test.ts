import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore no types for the browser module
import { parse, format, fits64, toggle, bytes } from '../../../public/_/base/lib.js';

test('parse and format across bases', () => {
  assert.equal(parse('ff', 16), 255n);
  assert.equal(parse('0xFF', 16), 255n);
  assert.equal(parse('1111_1111', 2), 255n);
  assert.equal(parse('0b101', 2), 5n);
  assert.equal(parse('-zz', 36), -1295n);
  assert.equal(parse('777', 8), 511n);
  assert.equal(format(255n, 2), '11111111');
  assert.equal(format(-255n, 16), '-ff');
  assert.equal(format(1295n, 36), 'zz');
  for (const bad of ['', '-', '2', 'g', '0x']) assert.equal(parse(bad, bad === 'g' ? 16 : 2), null, bad);
});

test('2^64 and beyond', () => {
  const n = parse('18446744073709551616', 10)!;
  assert.equal(n, 2n ** 64n);
  assert.equal(format(n, 16), '10000000000000000');
  assert.equal(format(n, 2), '1' + '0'.repeat(64));
  assert.equal(format(n, 36), '3w5e11264sgsg');
  assert.equal(parse(format(n, 36), 36), n);
  const huge = 10n ** 100n + 12345n;
  for (const b of [2, 7, 16, 36]) assert.equal(parse(format(huge, b), b), huge);
  assert.ok(fits64(2n ** 64n - 1n) && !fits64(2n ** 64n) && fits64(-(2n ** 63n)) && !fits64(-(2n ** 63n) - 1n));
});

test('negatives and bit toggling', () => {
  assert.equal(parse('-1', 10), -1n);
  assert.equal(toggle(5n, 1), 7n);
  assert.equal(toggle(7n, 0), 6n);
  assert.equal(toggle(0n, 63), 2n ** 63n);
  assert.equal(toggle(-1n, 0), -2n); // stays signed
  assert.equal(toggle(-1n, 63), 2n ** 63n - 1n);
});

test('bytes', () => {
  assert.deepEqual(bytes(0n), ['00']);
  assert.deepEqual(bytes(255n), ['ff']);
  assert.deepEqual(bytes(256n), ['01', '00']);
  assert.deepEqual(bytes(2n ** 64n), ['01', ...Array(8).fill('00')]);
  assert.deepEqual(bytes(-1n), ['ff']);
  assert.deepEqual(bytes(-128n), ['80']);
  assert.deepEqual(bytes(-129n), ['ff', '7f']);
  assert.deepEqual(bytes(0xdeadbeefn), ['de', 'ad', 'be', 'ef']);
});
