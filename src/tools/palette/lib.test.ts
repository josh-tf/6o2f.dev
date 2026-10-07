import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { harmony, kmeans, exportAs, oklchFit, slug } from '../../../public/_/palette/lib.js';
// @ts-ignore browser module
import { parse, rgbToOklch, rgbToHsl } from '../../../public/_/color/lib.js';

const hue = (hex: string, space: string) => (space === 'oklch' ? rgbToOklch(parse(hex)).h : rgbToHsl(parse(hex)).h);
const hueDiff = (a: number, b: number) => ((((b - a) % 360) + 540) % 360) - 180;

test('HSL harmonies hit the textbook hues', () => {
  assert.deepEqual(harmony(parse('#ff0000'), 'complementary', 'hsl'), ['#ff0000', '#00ffff']);
  assert.deepEqual(harmony(parse('#ff0000'), 'triadic', 'hsl'), ['#ff0000', '#00ff00', '#0000ff']);
  assert.deepEqual(harmony(parse('#ff0000'), 'tetradic', 'hsl'), ['#ff0000', '#80ff00', '#00ffff', '#8000ff']);
  assert.deepEqual(harmony(parse('#ff0000'), 'split', 'hsl'), ['#ff0000', '#00ff80', '#0080ff']);
  assert.deepEqual(harmony(parse('#ff0000'), 'analogous', 'hsl'), ['#ff00ff', '#ff0080', '#ff0000', '#ff8000', '#ffff00']);
});
test('OKLCH harmonies rotate the OKLCH hue and keep the base first/unchanged', () => {
  for (const kind of ['complementary', 'triadic', 'tetradic', 'split']) {
    const out = harmony(parse('#0b7a35'), kind, 'oklch');
    assert.equal(out[0], '#0b7a35');
    const step = { complementary: [180], triadic: [120, 240], tetradic: [90, 180, 270], split: [150, 210] }[kind]!;
    out.slice(1).forEach((h: string, i: number) => assert.ok(Math.abs(hueDiff(hue('#0b7a35', 'oklch') + step[i], hue(h, 'oklch'))) < 3, `${kind} ${h}`));
  }
});
test('monochrome keeps the hue, varies lightness, sorted light to dark; shades darken', () => {
  for (const space of ['oklch', 'hsl']) {
    const m = harmony(parse('#3366cc'), 'monochrome', space);
    assert.equal(m.length, 5);
    const L = m.map((h: string) => rgbToOklch(parse(h)).l);
    for (let i = 1; i < 5; i++) assert.ok(L[i] < L[i - 1]);
    for (const h of m) assert.ok(Math.abs(hueDiff(hue('#3366cc', space), hue(h, space))) < 6, h);
    const s = harmony(parse('#3366cc'), 'shades', space);
    assert.equal(s[0], '#3366cc');
    const SL = s.map((h: string) => rgbToOklch(parse(h)).l);
    for (let i = 1; i < 5; i++) assert.ok(SL[i] < SL[i - 1]);
  }
});
test('every output is a valid hex, even for black, white and greys', () => {
  for (const base of ['#000000', '#ffffff', '#808080', '#ffff00'])
    for (const kind of ['complementary', 'analogous', 'triadic', 'tetradic', 'split', 'monochrome', 'shades'])
      for (const space of ['oklch', 'hsl']) for (const h of harmony(parse(base), kind, space)) assert.match(h, /^#[0-9a-f]{6}$/);
});
test('oklchFit keeps lightness and hue when the chroma is out of gamut', () => {
  const c = oklchFit(0.7, 0.4, 250),
    o = rgbToOklch(c);
  assert.ok(Math.abs(o.l - 0.7) < 0.01 && Math.abs(hueDiff(o.h, 250)) < 2);
});

function image(colors: [number, number, number][], counts: number[]) {
  const px: number[] = [];
  colors.forEach((c, i) => {
    for (let j = 0; j < counts[i]; j++) px.push(c[0] + (j % 3) - 1, c[1], c[2] + (j % 2), 255);
  });
  return new Uint8ClampedArray(px);
}
test('k-means finds the dominant clusters with their shares', () => {
  const data = image(
    [
      [200, 30, 30],
      [30, 30, 200],
      [240, 240, 240],
    ],
    [500, 300, 200],
  );
  const out = kmeans(data, 3, 7);
  assert.equal(out.length, 3);
  assert.deepEqual(
    out.map((c: { share: number }) => Math.round(c.share * 10) / 10),
    [0.5, 0.3, 0.2],
  );
  assert.match(out[0].hex, /^#c8/);
});
test('k-means is deterministic for a seed and ignores transparent pixels', () => {
  const data = new Uint8ClampedArray(4000);
  const r = (i: number) => (i * 2654435761) >>> 24;
  for (let i = 0; i < 1000; i++) data.set([r(i), r(i + 7), r(i + 13), 255], i * 4);
  assert.deepEqual(kmeans(data, 6, 42), kmeans(data, 6, 42));
  assert.equal(kmeans(new Uint8ClampedArray([1, 2, 3, 0, 4, 5, 6, 10]), 5).length, 0);
  assert.deepEqual(kmeans(new Uint8ClampedArray(Array(50).fill([10, 20, 30, 255]).flat()), 6), [{ hex: '#0a141e', share: 1 }]); // fewer colours than k
});
test('exports', () => {
  const p = ['#112233', '#445566'];
  assert.equal(exportAs(p, 'css', 'My Brand!'), ':root {\n  --my-brand-100: #112233;\n  --my-brand-200: #445566;\n}');
  assert.equal(exportAs(p, 'scss', 'x'), '$x: (\n  100: #112233,\n  200: #445566,\n);');
  assert.deepEqual(JSON.parse(exportAs(p, 'json')), { 100: '#112233', 200: '#445566' });
  assert.match(exportAs(p, 'tailwind', 'brand'), /'brand': \{\n\s+100: '#112233',/);
  assert.match(exportAs(p, 'tailwind4', 'brand'), /--color-brand-200: #445566;/);
  assert.equal(slug('  '), 'color');
  assert.equal(slug('1 Brand!'), 'brand');
});
