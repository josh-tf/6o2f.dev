import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { PRESETS, rgba, shadowCss } from '../../../public/_/shadow/lib.js';

test('rgba', () => assert.equal(rgba('#ff8000', 0.5), 'rgba(255, 128, 0, 0.5)'));
test('box and text css', () => {
  const l = { x: 2, y: 0, blur: 10, spread: -3, color: '#000000', alpha: 0.25, inset: true };
  assert.equal(shadowCss([l]), 'box-shadow: inset 2px 0 10px -3px rgba(0, 0, 0, 0.25);');
  assert.equal(shadowCss([l], true), 'text-shadow: 2px 0 10px rgba(0, 0, 0, 0.25);');
  assert.equal(shadowCss([]), 'box-shadow: none;');
  assert.match(shadowCss(PRESETS.Layered), /,\n/);
});
