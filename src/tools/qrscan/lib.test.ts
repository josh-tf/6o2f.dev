import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { classify, decodePixels } from '../../../public/_/qrscan/lib.js';
// @ts-ignore vendored encoder (through the QR tool's UTF-8 wrapper)
import { matrix } from '../../../public/_/qr/lib.js';
// @ts-ignore vendored decoder
import jsQR from '../../../public/_/qrscan/vendor/jsqr.min.js';

/** Render a module matrix to RGBA pixels with a quiet zone, `scale` px per module. */
function pixels(m: boolean[][], scale = 4, quiet = 4, invert = false) {
  const n = m.length + quiet * 2,
    w = n * scale,
    data = new Uint8ClampedArray(w * w * 4);
  for (let y = 0; y < w; y++)
    for (let x = 0; x < w; x++) {
      const r = Math.floor(y / scale) - quiet,
        c = Math.floor(x / scale) - quiet;
      let dark = r >= 0 && c >= 0 && r < m.length && c < m.length && m[r][c];
      if (invert) dark = !dark;
      data.set(dark ? [0, 0, 0, 255] : [255, 255, 255, 255], (y * w + x) * 4);
    }
  return { data, w };
}

test('decodes codes made by the vendored encoder (ASCII, UTF-8, long, inverted)', () => {
  for (const text of ['https://6o2f.dev/', 'WIFI:T:WPA;S:Café 5G;P:p\\;ss;;', 'Grüße aus Zürich ✓ 日本語', 'x'.repeat(600)]) {
    const { data, w } = pixels(matrix(text, 'M'));
    assert.equal(decodePixels(jsQR, data, w, w), text);
  }
  const { data, w } = pixels(matrix('inverted', 'H'), 3, 4, true);
  assert.equal(decodePixels(jsQR, data, w, w), 'inverted');
});
test('returns null when there is no code', () => {
  const data = new Uint8ClampedArray(64 * 64 * 4).fill(255);
  assert.equal(decodePixels(jsQR, data, 64, 64), null);
});

test('urls', () => {
  assert.deepEqual(classify('https://example.com/a?b=1'), {
    type: 'url',
    label: 'Web link',
    fields: [
      ['Host', 'example.com'],
      ['URL', 'https://example.com/a?b=1'],
    ],
    href: 'https://example.com/a?b=1',
  });
  assert.equal(classify('www.example.org/x').href, 'https://www.example.org/x');
  assert.equal(classify('javascript:alert(1)').type, 'text');
  assert.equal(classify('javascript:alert(1)').href, undefined);
  assert.equal(classify('data:text/html,<script>').href, undefined);
  assert.equal(classify('https://a.example has spaces').type, 'text');
});
test('wifi with escapes', () => {
  const r = classify('WIFI:T:WPA;S:My\\;Net;P:pa\\:ss\\\\w;H:true;;');
  assert.equal(r.type, 'wifi');
  assert.deepEqual(r.fields, [
    ['Network', 'My;Net'],
    ['Security', 'WPA'],
    ['Password', 'pa:ss\\w'],
    ['Hidden', 'Yes'],
  ]);
  assert.deepEqual(classify('WIFI:S:Cafe;T:nopass;;').fields, [
    ['Network', 'Cafe'],
    ['Security', 'None (open)'],
  ]);
  assert.equal(classify('WIFI:S:x;').href, undefined);
});
test('vcard and mecard', () => {
  const v = classify(
    'BEGIN:VCARD\r\nVERSION:3.0\r\nN:Lovelace;Ada;;;\r\nFN:Ada Lovelace\r\nORG:Analytical Engines\r\nTEL;TYPE=CELL:+44 20 7946 0000\r\nEMAIL:ada@example.com\r\nEND:VCARD',
  );
  assert.equal(v.type, 'contact');
  assert.deepEqual(v.fields, [
    ['Name', 'Ada Lovelace'],
    ['Organisation', 'Analytical Engines'],
    ['Phone', '+44 20 7946 0000'],
    ['Email', 'ada@example.com'],
  ]);
  const m = classify('MECARD:N:Lovelace,Ada;TEL:+442079460000;EMAIL:ada@example.com;;');
  assert.deepEqual(m.fields, [
    ['Name', 'Ada Lovelace'],
    ['Phone', '+442079460000'],
    ['Email', 'ada@example.com'],
  ]);
});
test('mailto, tel, sms, geo, plain', () => {
  const e = classify('mailto:hi@example.com?subject=Hello%20there&body=Hi');
  assert.equal(e.type, 'email');
  assert.deepEqual(e.fields, [
    ['To', 'hi@example.com'],
    ['Subject', 'Hello there'],
    ['Body', 'Hi'],
  ]);
  assert.equal(classify('MATMSG:TO:a@b.c;SUB:Yo;BODY:x;;').href, 'mailto:a%40b.c?subject=Yo&body=x');
  assert.deepEqual(classify('tel:+61 2 9999 0000'), { type: 'tel', label: 'Phone number', fields: [['Number', '+61 2 9999 0000']], href: 'tel:+61299990000' });
  const s = classify('SMSTO:+15551234567:Running late');
  assert.equal(s.type, 'sms');
  assert.deepEqual(s.fields, [
    ['To', '+15551234567'],
    ['Message', 'Running late'],
  ]);
  assert.equal(s.href, 'sms:+15551234567?body=Running%20late');
  assert.deepEqual(classify('sms:+1555?body=Hi%20there').fields, [
    ['To', '+1555'],
    ['Message', 'Hi there'],
  ]);
  const g = classify('geo:-33.8568,151.2153?q=Sydney%20Opera%20House');
  assert.equal(g.type, 'geo');
  assert.deepEqual(g.fields, [
    ['Latitude', '-33.8568'],
    ['Longitude', '151.2153'],
    ['Label', 'Sydney Opera House'],
  ]);
  assert.match(g.href, /^https:\/\/www\.openstreetmap\.org\/\?mlat=-33.8568&mlon=151.2153/);
  assert.equal(classify('geo:123,0').type, 'text');
  assert.equal(classify('Just some text').type, 'text');
});
