import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { blobPath, points, toSvg, toClip, parseHash, rng } from '../../../public/_/blob/lib.js';

const P = { seed: 'abc', n: 7, randomness: 0.6, size: 400 };
test('same seed gives the same path, different seed differs', () => {
  assert.equal(blobPath(P), blobPath({ ...P }));
  assert.notEqual(blobPath(P), blobPath({ ...P, seed: 'abd' }));
});
test('rng is deterministic and in [0,1)', () => {
  const a = rng('x'),
    b = rng('x');
  for (let i = 0; i < 100; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
});
test('path is closed, has n cubic segments and only finite numbers', () => {
  for (const n of [3, 5, 12])
    for (const randomness of [0, 0.5, 1]) {
      const d = blobPath({ ...P, n, randomness });
      assert.match(d, /^M[\d. -]+(C[\d. -]+)+Z$/);
      assert.equal(d.endsWith('Z'), true);
      assert.equal(d.split('C').length - 1, n);
      const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
      assert.ok(nums.every(Number.isFinite));
      assert.equal(nums.length, 2 + n * 6);
    }
});
test('points stay inside the box and n is clamped to 3..12', () => {
  for (const [x, y] of points('q', 12, 1, 200)) assert.ok(x > 0 && x < 200 && y > 0 && y < 200);
  assert.equal(points('q', 1, 0, 100).length, 3);
  assert.equal(points('q', 99, 0, 100).length, 12);
});
test('the drawn curve (not just its points) stays inside the box', () => {
  const at = (p: number[][], i: number, t: number, k: number) => {
    const n = p.length,
      [a, b, c, d] = [p[(i - 1 + n) % n], p[i], p[(i + 1) % n], p[(i + 2) % n]];
    const c1 = b[k] + (c[k] - a[k]) / 6,
      c2 = c[k] - (d[k] - b[k]) / 6,
      u = 1 - t;
    return u * u * u * b[k] + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * c[k];
  };
  for (let s = 0; s < 400; s++)
    for (const n of [3, 5, 8]) {
      const p = points('s' + s, n, 1, 400);
      for (let i = 0; i < n; i++)
        for (let t = 0; t <= 1; t += 0.05)
          for (const k of [0, 1]) {
            const v = at(p, i, t, k);
            assert.ok(v >= 0 && v <= 400, `seed s${s} n${n}: ${v}`);
          }
    }
});
test('svg output: gradient, outline, and bad colours fall back', () => {
  const d = blobPath(P);
  const s = toSvg({ d, size: 400, fill: { mode: 'gradient', a: '#ff0000', b: '#0000ff', angle: 90 }, stroke: { on: true, color: '#000000', width: 4 } });
  assert.match(s, /linearGradient/);
  assert.match(s, /stroke-width="4"/);
  assert.match(s, /viewBox="-2 -2 404 404" width="400"/);
  const t = toSvg({ d, size: 400, fill: { mode: 'solid', a: 'javascript:1', b: '' }, stroke: { on: false } });
  assert.doesNotMatch(t, /javascript/);
  assert.doesNotMatch(t, /stroke/);
});
test('clip-path and hash parsing', () => {
  assert.match(toClip('M0 0Z'), /^clip-path: path\('M0 0Z'\);$/);
  assert.deepEqual(parseHash('#seed=abc&n=7&r=0.4'), { seed: 'abc', n: 7, r: 0.4 });
  assert.deepEqual(parseHash('#n=zzz'), {});
});
