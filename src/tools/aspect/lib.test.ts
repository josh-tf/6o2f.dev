import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { simplify, nearestName, heightFor, widthFor, fit, crop, ppi, resolutionsFor, round } from '../../../public/_/aspect/lib.js';

test('simplify', () => {
  assert.deepEqual(simplify(1920, 1080), [16, 9]);
  assert.deepEqual(simplify(1366, 768), [683, 384]);
  assert.deepEqual(simplify(2560, 1080), [64, 27]);
  assert.deepEqual(simplify(1.85, 1), [37, 20]);
  assert.deepEqual(simplify(8.5, 11), [17, 22]);
  assert.deepEqual(simplify(1080, 1920), [9, 16]);
  assert.equal(simplify(0, 5), null);
  assert.equal(simplify(-1, 5), null);
});
test('nearest named ratio', () => {
  assert.deepEqual(nearestName(1366, 768), { name: '16:9', exact: false });
  assert.deepEqual(nearestName(1920, 1080), { name: '16:9', exact: true });
  assert.equal(nearestName(1080, 1920)!.name, '9:16');
  assert.equal(nearestName(3440, 1440)!.name, '21:9 ultrawide');
  assert.equal(nearestName(210, 297)!.name, 'ISO 216 (A4) √2 (portrait)');
  assert.equal(nearestName(1618, 1000)!.name, 'Golden ratio (landscape)');
  assert.equal(nearestName(7, 3.3), null);
});
test('resize keeps the ratio', () => {
  assert.equal(heightFor(1280, 1920, 1080), 720);
  assert.equal(widthFor(2160, 1920, 1080), 3840);
});
test('fit and crop', () => {
  const f = fit(1920, 1080, 1080, 1080);
  assert.deepEqual(f.contain, { w: 1080, h: 608, scale: 0.5625 });
  assert.deepEqual(f.cover, { w: 1920, h: 1080, scale: 1 });
  assert.deepEqual(f.cropped, { x: 840, y: 0 });
  assert.deepEqual(crop(1920, 1080, 1, 1), { w: 1080, h: 1080, x: 420, y: 0 });
  assert.deepEqual(crop(1920, 1080, 9, 16), { w: 608, h: 1080, x: 656, y: 0 });
  assert.deepEqual(crop(1080, 1920, 16, 9), { w: 1080, h: 608, x: 0, y: 656 });
  assert.deepEqual(crop(4000, 3000, 16, 9), { w: 4000, h: 2250, x: 0, y: 375 });
});
test('ppi', () => {
  assert.equal(round(ppi(1920, 1080, 24).ppi), '91.79');
  assert.equal(round(ppi(2560, 1440, 27).ppi), '108.79');
  assert.equal(round(ppi(3840, 2160, 27).ppi), '163.18');
  assert.equal(round(ppi(1920, 1080, 24).pitchMm, 3), '0.277');
});
test('resolution table', () => {
  const r = resolutionsFor(16, 9).map((x: any) => x[0]);
  assert.ok(r.includes(1920) && r.includes(3840) && r.includes(1366) && !r.includes(1024));
  assert.deepEqual(
    resolutionsFor(4, 3).map((x: any) => x[1]),
    [480, 600, 768, 1050, 1200, 1536],
  );
});
