import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { aspect, bytes, toText, toJSON, mq, FEATURES, runFeatures } from '../../../public/_/screen/lib.js';

test('aspect ratio', () => {
  assert.equal(aspect(1920, 1080), '16:9');
  assert.equal(aspect(1440, 900), '8:5');
  assert.equal(aspect(1024, 768), '4:3');
  assert.equal(aspect(1080, 1920), '9:16');
  assert.equal(aspect(2560, 1080), '21:9');
  assert.equal(aspect(1366, 768), '16:9');
  assert.equal(aspect(390, 844), '9:19.5');
  assert.equal(aspect(1000, 1000), '1:1');
  assert.equal(aspect(1650, 1000), '1.65:1');
  assert.equal(aspect(0, 100), '');
  assert.equal(aspect(NaN, 1), '');
});
test('bytes', () => {
  assert.equal(bytes(0), '0 bytes');
  assert.equal(bytes(1023), '1023 bytes');
  assert.equal(bytes(1536), '1.5 KB');
  assert.equal(bytes(8 * 1024 ** 3), '8.0 GB');
  assert.equal(bytes(300 * 1024 ** 3), '300 GB');
  assert.equal(bytes(undefined), '');
});
test('reports', () => {
  const g = [
    {
      title: 'Display',
      rows: [
        ['Screen', '1920 × 1080'],
        ['HDR', ''],
      ],
    },
  ];
  const f = [
    { name: 'WebGL', ok: true },
    { name: 'WebGPU', ok: false },
  ];
  assert.equal(toText(g, f), '## Display\nScreen  1920 × 1080\nHDR     -\n\n## Features\nWebGL   yes\nWebGPU  no\n');
  assert.deepEqual(JSON.parse(toJSON(g, f)), { Display: { Screen: '1920 × 1080', HDR: '' }, Features: { WebGL: true, WebGPU: false } });
});
test('media queries', () => {
  const w = {
    matchMedia: (q: string) => ({ matches: q === '(color-gamut: p3)' || q === '(color-gamut: srgb)' || q === '(prefers-contrast: no-preference)', media: q }),
  };
  assert.equal(mq(w, 'color-gamut', ['rec2020', 'p3', 'srgb'], ''), 'p3');
  assert.equal(mq(w, 'prefers-contrast', ['more', 'less', 'custom']), 'no-preference');
  assert.equal(mq(w, 'dynamic-range', ['high'], 'standard'), 'not supported');
  assert.equal(mq({}, 'x', ['y']), '');
});
test('feature tests never throw', () => {
  assert.ok(FEATURES.length >= 40);
  const none = runFeatures({});
  assert.equal(none.length, FEATURES.length);
  assert.ok(none.every((f: any) => f.ok === false && f.note));
  const throwing = new Proxy(
    {},
    {
      get() {
        throw new Error('boom');
      },
      has() {
        throw new Error('boom');
      },
    },
  );
  assert.ok(runFeatures(throwing).every((f: any) => f.ok === false));
  const fake = {
    navigator: { gpu: {}, clipboard: { writeText() {} } },
    WebAssembly: {},
    RTCPeerConnection: function () {},
    CSS: { supports: (s: string) => s === 'selector(:has(a))' },
  };
  const r = Object.fromEntries(runFeatures(fake).map((f: any) => [f.name, f.ok]));
  assert.equal(r.WebGPU, true);
  assert.equal(r.WebAssembly, true);
  assert.equal(r.WebRTC, true);
  assert.equal(r['Async Clipboard'], true);
  assert.equal(r['CSS :has()'], true);
  assert.equal(r['CSS nesting'], false);
  assert.equal(r.WebUSB, false);
});
