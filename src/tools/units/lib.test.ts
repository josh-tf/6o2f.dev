import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore no types for the browser module
import { CATS, convert, show } from '../../../public/_/units/lib.js';

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${a} != ${b}`);

test('round trips for every pair in every category', () => {
  for (const cat of Object.keys(CATS))
    for (const a of Object.keys(CATS[cat])) for (const b of Object.keys(CATS[cat])) close(convert(cat, b, a, convert(cat, a, b, 123.456)), 123.456);
});
test('known values', () => {
  close(convert('length', 'mi', 'km', 1), 1.609344);
  close(convert('length', 'in', 'cm', 1), 2.54);
  close(convert('mass', 'lb', 'kg', 1), 0.45359237);
  close(convert('volume', 'gal', 'l', 1), 3.785411784);
  close(convert('speed', 'mph', 'kmh', 60), 96.56064);
  close(convert('area', 'ac', 'ha', 1), 0.40468564224);
  close(convert('time', 'd', 'h', 1), 24);
});
test('data: SI vs binary', () => {
  assert.equal(convert('data', 'GB', 'MB', 1), 1000);
  assert.equal(convert('data', 'GiB', 'MiB', 1), 1024);
  assert.equal(convert('data', 'KiB', 'B', 1), 1024);
  close(convert('data', 'GiB', 'GB', 1), 1.073741824);
  assert.equal(convert('data', 'B', 'bit', 1), 8);
});
test('temperature', () => {
  close(convert('temperature', 'c', 'f', 100), 212);
  close(convert('temperature', 'c', 'f', -40), -40);
  close(convert('temperature', 'f', 'c', 32), 0);
  close(convert('temperature', 'c', 'k', 0), 273.15);
  close(convert('temperature', 'k', 'c', 0), -273.15);
  close(convert('temperature', 'k', 'f', 0), -459.67);
  close(convert('temperature', 'f', 'k', 98.6), 310.15);
});
test('show', () => {
  assert.equal(show(0.1 + 0.2), '0.3');
  assert.equal(show(1e20), '1e+20');
  assert.equal(show(NaN), '');
  assert.equal(show(0), '0');
});
test('parseNum and sym', async () => {
  // @ts-ignore
  const { parseNum, sym } = await import('../../../public/_/units/lib.js');
  assert.equal(parseNum('2,5'), 2.5);
  assert.equal(parseNum('1,000'), 1000);
  assert.equal(parseNum('1,000.5'), 1000.5);
  assert.equal(parseNum(' 1 000 '), 1000);
  assert.equal(parseNum('-3e2'), -300);
  assert.equal(parseNum('.5'), 0.5);
  for (const bad of ['', 'abc', 'Infinity', '1..2', '0x10', '1e999']) assert.equal(parseNum(bad), null, bad);
  assert.equal(sym('speed', 'ms'), 'm/s');
  assert.equal(sym('temperature', 'c'), '°C');
  assert.equal(sym('data', 'kB'), 'kB');
  assert.equal(sym('length', 'nmi'), 'nmi');
  assert.equal(sym('volume', 'floz'), 'fl oz');
});
