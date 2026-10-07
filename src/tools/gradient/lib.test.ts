import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { backgroundCss, gradientCss, randomGradient } from '../../../public/_/gradient/lib.js';

const stops = [
  { color: '#ff0000', pos: 0 },
  { color: '#0000ff', pos: 100 },
];
test('css strings', () => {
  assert.equal(gradientCss({ type: 'linear', angle: 45, stops }), 'linear-gradient(45deg, #ff0000 0%, #0000ff 100%)');
  assert.equal(gradientCss({ type: 'radial', shape: 'ellipse', x: 20, y: 80, stops }), 'radial-gradient(ellipse at 20% 80%, #ff0000 0%, #0000ff 100%)');
  assert.equal(gradientCss({ type: 'conic', angle: 90, x: 50, y: 50, stops }), 'conic-gradient(from 90deg at 50% 50%, #ff0000 0%, #0000ff 100%)');
  assert.equal(backgroundCss({ stops, angle: '' }), 'background: linear-gradient(180deg, #ff0000 0%, #0000ff 100%);');
});
test('random is valid', () => {
  for (let i = 0; i < 50; i++) {
    const g = randomGradient();
    assert.ok(g.stops.length >= 2 && g.stops.every((s: any) => /^#[0-9a-f]{6}$/.test(s.color)));
  }
});
