import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { parse, toHex, toRgb, toHsl, toOklch, nameOf, contrast, verdicts, ramp, oklchToRgb, rgbToOklch } from '../../../public/_/color/lib.js';

test('oklch against known values', () => {
  assert.equal(toOklch(parse('#ff0000')), 'oklch(62.8% 0.2577 29.23)');
  assert.equal(toOklch(parse('#0000ff')), 'oklch(45.2% 0.3132 264.05)');
  assert.equal(toOklch(parse('#00ff00')), 'oklch(86.6% 0.2948 142.5)');
  assert.equal(toOklch(parse('#ffffff')), 'oklch(100% 0 0)');
  assert.equal(toOklch(parse('#000')), 'oklch(0% 0 0)');
  assert.equal(toOklch(parse('#808080')), 'oklch(60% 0 0)');
});
test('oklch round trip', () => {
  for (const h of ['#1a2b3c', '#ff8800', '#7dff9b', '#0b7a35', '#fedcba']) {
    const c = parse(h),
      { l, c: ch, h: hue } = rgbToOklch(c);
    assert.equal(toHex({ ...oklchToRgb(l, ch, hue), a: 1 }), h);
  }
});
test('parsing', () => {
  assert.equal(toHex(parse('#f80')), '#ff8800');
  assert.equal(toHex(parse('Transparent')), '#00000000');
  assert.equal(toHex(parse('#f808')), '#ff880088');
  assert.equal(toHex(parse('FF8800')), '#ff8800');
  assert.equal(toHex(parse('#11223344')), '#11223344');
  assert.equal(toHex(parse('rgb(255, 136, 0)')), '#ff8800');
  assert.equal(toHex(parse('rgb(100% 0% 0% / 50%)')), '#ff000080');
  assert.equal(toHex(parse('hsl(120, 100%, 25%)')), '#008000');
  assert.equal(toHex(parse('hsl(0 0% 100%)')), '#ffffff');
  assert.equal(toHex(parse('oklch(62.8% 0.2577 29.23)')), '#ff0000');
  assert.equal(toHex(parse('oklch(0.628 0.2577 29.23deg)')), '#ff0000');
  assert.equal(toHex(parse('rebeccapurple')), '#663399');
  for (const bad of ['', '#12', '#12345', 'rgb(1,2)', 'rgb(a,b,c)', 'banana', 'hsl()', 'rgb(1 2 3 4 5)']) assert.equal(parse(bad), null, bad);
});
test('formats', () => {
  const c = parse('#ff8800');
  assert.equal(toRgb(c), 'rgb(255, 136, 0)');
  assert.equal(toHsl(c), 'hsl(32, 100%, 50%)');
  assert.equal(toRgb(parse('#ff000080')), 'rgba(255, 0, 0, 0.502)');
  assert.equal(nameOf(parse('#ff0000')), 'red');
  assert.equal(nameOf(parse('#00ffff')), 'aqua');
  assert.equal(nameOf(parse('#ff0001')), null);
  assert.equal(nameOf(parse('#ff000080')), null);
});
test('wcag contrast', () => {
  const W = parse('#fff');
  assert.equal(contrast(parse('#000'), W), 21);
  assert.equal(contrast(W, W), 1);
  assert.equal(+contrast(parse('#767676'), W).toFixed(2), 4.54);
  assert.equal(+contrast(parse('#777'), W).toFixed(2), 4.48);
  assert.deepEqual(verdicts(4.54), { aaNormal: true, aaLarge: true, aaaNormal: false, aaaLarge: true });
  assert.deepEqual(verdicts(2.9), { aaNormal: false, aaLarge: false, aaaNormal: false, aaaLarge: false });
});
test('ramp', () => {
  const r = ramp(parse('#0b7a35'));
  assert.equal(r.length, 9);
  assert.equal(r[4].hex, '#0b7a35');
  const ls = r.map((x: any) => rgbToOklch(parse(x.hex)).l);
  for (let i = 1; i < 9; i++) assert.ok(ls[i] < ls[i - 1], 'lightness decreases');
});

// @ts-ignore browser module
import { rgbToHsv, hsvToRgb, pageTheme } from '../../../public/_/color/lib.js';
test('hsv round trips', () => {
  for (const hex of ['#ff0000', '#0b7a35', '#336699', '#ffffff', '#000000', '#808080', '#ffcc00']) {
    const c = parse(hex);
    const { h, s, v } = rgbToHsv(c);
    const b = hsvToRgb(h, s, v);
    assert.equal(toHex({ ...b, a: 1 }), hex);
  }
  assert.deepEqual(rgbToHsv({ r: 0, g: 255, b: 0 }), { h: 120, s: 1, v: 1 });
});
test('pageTheme keeps the accent readable on its own tinted background in both modes', () => {
  for (const hex of ['#0b7a35', '#ffcc00', '#000000', '#ffffff', '#ff00ff', '#222244', '#ddeeff', '#808080'])
    for (const dark of [true, false]) {
      const t = pageTheme(parse(hex), dark);
      assert.ok(contrast(parse(t['--accent']), parse(t['--bg'])) >= 4.4, `${hex} ${dark ? 'dark' : 'light'} accent ${t['--accent']} on ${t['--bg']}`);
      assert.ok(contrast(parse(t['--fg']), parse(t['--bg'])) >= 7, 'body text stays AAA on the tint');
      assert.ok(/^#[0-9a-f]{6}$/.test(t['--card']));
    }
});
