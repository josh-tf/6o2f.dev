import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { scale, lineHeight, format, RATIOS } from '../../../public/_/typo/lib.js';
// @ts-ignore browser module
import { fluid } from '../../../public/_/clamp/lib.js';

const RULE = { mode: 'fixed', value: 1.5, grid: 0 };
const base = { base: 16, ratio: 1.25, up: 5, down: 2, root: 16, rule: RULE };

test('ratio presets are the classic intervals', () => {
  const m = Object.fromEntries(RATIOS);
  assert.equal(m['Minor second'], 16 / 15);
  assert.equal(m['Major third'], 1.25);
  assert.equal(m['Perfect fourth'], 4 / 3);
  assert.equal(m['Perfect fifth'], 1.5);
  assert.ok(Math.abs(m['Golden ratio'] - 1.618034) < 1e-6);
  assert.equal(RATIOS.length, 8);
});
test('major third from 16px', () => {
  const rows = scale(base);
  assert.deepEqual(
    rows.map((r: { step: number }) => r.step),
    [5, 4, 3, 2, 1, 0, -1, -2],
  );
  assert.deepEqual(
    rows.map((r: { px: number }) => r.px),
    [48.83, 39.06, 31.25, 25, 20, 16, 12.8, 10.24],
  );
  assert.equal(rows.find((r: { step: number }) => r.step === 3).rem, 1.9531);
  assert.equal(rows.find((r: { step: number }) => r.step === 0).rem, 1);
});
test('rem uses the root size', () => {
  assert.equal(scale({ ...base, root: 10, up: 0, down: 0 })[0].rem, 1.6);
});
test('line-height rules', () => {
  assert.equal(lineHeight(16, RULE), 1.5);
  assert.equal(lineHeight(16, { mode: 'gap', value: 8, grid: 0 }), 1.5);
  assert.equal(lineHeight(48, { mode: 'gap', value: 8, grid: 0 }), 1.167); // tightens on big text
  assert.equal(lineHeight(20, { mode: 'fixed', value: 1.5, grid: 4 }), 1.6); // 30 -> 32 on a 4px grid
  assert.equal(lineHeight(16, { mode: 'fixed', value: 1.5, grid: 4 }), 1.5); // 24 is already on the grid
  assert.equal(lineHeight(12, { mode: 'gap', value: 8, grid: 0, base: 16 }), 1.5); // below the base: keeps the base ratio
  assert.equal(lineHeight(32, { mode: 'gap', value: 8, grid: 0, base: 16 }), 1.25);
});
test('fluid uses the same clamp() maths as the Fluid type tool', () => {
  const rows = scale({ ...base, fluid: { base: 18, ratio: 4 / 3, minVw: 360, maxVw: 1240 } });
  const s2 = rows.find((r: { step: number }) => r.step === 2);
  assert.equal(s2.px, 25);
  assert.equal(s2.max, 32);
  assert.equal(s2.clamp, fluid({ min: 25, max: 32, minVw: 360, maxVw: 1240, unit: 'rem', root: 16 }).css);
  assert.equal(s2.clamp, 'clamp(1.5625rem, calc(1.3835rem + 0.7955vw), 2rem)');
  assert.match(scale({ ...base, unit: 'px', fluid: { base: 18, ratio: 1.2, minVw: 320, maxVw: 1200 } })[0].clamp, /^clamp\([\d.]+px,/);
});
test('invalid input gives null', () => {
  assert.equal(scale({ ...base, ratio: 1 }), null);
  assert.equal(scale({ ...base, base: 0 }), null);
  assert.equal(scale({ ...base, fluid: { base: 18, ratio: 1.2, minVw: 1200, maxVw: 320 } }), null);
});
test('formats', () => {
  const rows = scale({ ...base, up: 1, down: 1 });
  assert.equal(
    format(rows, 'css'),
    ':root {\n  --step-1: 1.25rem;\n  --step-0: 1rem;\n  --step--1: 0.8rem;\n  --step-1-lh: 1.5;\n  --step-0-lh: 1.5;\n  --step--1-lh: 1.5;\n}',
  );
  assert.match(format(rows, 'css', 'px'), /--step-1: 20px;/);
  assert.match(format(rows, 'tailwind', 'rem', 'text'), /'text-1': \['1.25rem', \{ lineHeight: '1.5' \}\],/);
  assert.match(format(rows, 'scss'), /"-1": \(font-size: 0.8rem, line-height: 1.5\),/);
});
