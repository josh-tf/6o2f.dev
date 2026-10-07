import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { fitSize, fmtBytes, saved } from '../../../public/_/img/lib.js';

test('fitSize', () => {
  assert.deepEqual(fitSize(4000, 2000, 1000, '', true), [1000, 500]);
  assert.deepEqual(fitSize(4000, 2000, 1000, 100, true), [200, 100]);
  assert.deepEqual(fitSize(400, 200, 1000, 1000, true), [400, 200]); // no upscale
  assert.deepEqual(fitSize(400, 200, 100, '', false), [100, 200]);
  assert.deepEqual(fitSize(400, 200, '', '', true), [400, 200]);
  assert.deepEqual(fitSize(10, 1, 1, '', true), [1, 1]);
});
test('format', () => {
  assert.equal(fmtBytes(1536), '1.5 KB');
  assert.equal(saved(1000, 250), '75% smaller');
  assert.equal(saved(100, 150), '50% larger');
});
test('saved never rounds to 0% or 100%', () => {
  assert.equal(saved(1600000, 7000), '99% smaller');
  assert.equal(saved(1000, 999), '1% smaller');
  assert.equal(saved(1000, 1000), 'same size');
  assert.equal(saved(1000, 3000), '3× larger');
});
