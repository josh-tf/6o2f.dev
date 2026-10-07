import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { fluid, sizeAt } from '../../../public/_/clamp/lib.js';

const P = { min: 16, max: 24, minVw: 320, maxVw: 1440 };
test('rem output', () => {
  // slope 8/1120 = 0.00714286 -> 0.7143vw; intercept 16 - 0.00714286*320 = 13.714286px = 0.8571rem
  assert.equal(fluid({ ...P, unit: 'rem' })!.css, 'clamp(1rem, calc(0.8571rem + 0.7143vw), 1.5rem)');
});
test('px output', () => {
  assert.equal(fluid({ ...P, unit: 'px' })!.css, 'clamp(16px, calc(13.7143px + 0.7143vw), 24px)');
});
test('size hits the endpoints and clamps outside', () => {
  assert.equal(sizeAt(P, 320), 16);
  assert.equal(sizeAt(P, 1440), 24);
  assert.equal(sizeAt(P, 100), 16);
  assert.equal(sizeAt(P, 3000), 24);
  assert.equal(sizeAt(P, 880), 20);
});
test('shrinking size swaps the clamp bounds', () => {
  const r = fluid({ min: 24, max: 16, minVw: 320, maxVw: 1440, unit: 'px' })!;
  assert.equal(r.css, 'clamp(16px, calc(26.2857px - 0.7143vw), 24px)');
  assert.equal(sizeAt({ min: 24, max: 16, minVw: 320, maxVw: 1440 }, 880), 20);
  assert.equal(sizeAt({ min: 24, max: 16, minVw: 320, maxVw: 1440 }, 5000), 16);
});
test('negative intercept', () => {
  assert.equal(fluid({ min: 16, max: 64, minVw: 400, maxVw: 800, unit: 'px' })!.css, 'clamp(16px, calc(-32px + 12vw), 64px)');
});
test('invalid input', () => {
  assert.equal(fluid({ ...P, minVw: 1440 }), null);
  assert.equal(fluid({ ...P, min: NaN }), null);
});
