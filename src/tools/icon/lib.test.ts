import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { radius, svgIcon } from '../../../public/_/icon/lib.js';

const o = { text: '🚀', shape: 'rounded', bg: '#4f46e5', bg2: '', fg: '#ffffff', weight: '700' };
test('svg', () => {
  const s = svgIcon(o, 100);
  assert.match(s, /rx="22"/);
  assert.match(s, />🚀<\/text>/);
  assert.ok(!s.includes('linearGradient'));
  assert.match(svgIcon({ ...o, bg2: '#000000', text: '<&' }), /url\(#g\).*&lt;&amp;/);
  assert.equal(radius({ shape: 'circle' }, 50), 25);
});
test('iconText keeps graphemes whole', async () => {
  // @ts-ignore
  const { iconText } = await import('../../../public/_/icon/lib.js');
  assert.equal(iconText('👨‍👩‍👧'), '👨‍👩‍👧');
  assert.equal(iconText('🇦🇺x'), '🇦🇺x');
  assert.equal(iconText(' abc '), 'ab');
  assert.equal(iconText(''), '?');
});
test('ico packs PNGs with a valid directory', async () => {
  // @ts-ignore
  const { ico } = await import('../../../public/_/icon/lib.js');
  const a = new Uint8Array([1, 2, 3]),
    b = new Uint8Array([4, 5]);
  const out: Uint8Array = ico([
    { size: 16, png: a },
    { size: 256, png: b },
  ]);
  const v = new DataView(out.buffer);
  assert.deepEqual([v.getUint16(0, true), v.getUint16(2, true), v.getUint16(4, true)], [0, 1, 2]);
  assert.equal(out[6], 16);
  assert.equal(out[22], 0); // 256 is stored as 0
  assert.equal(v.getUint32(6 + 8, true), 3);
  assert.equal(v.getUint32(6 + 12, true), 38);
  assert.equal(v.getUint32(22 + 12, true), 41);
  assert.deepEqual([...out.slice(38)], [1, 2, 3, 4, 5]);
});
