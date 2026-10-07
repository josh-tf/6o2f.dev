import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { contrast, contrastWarning, mailto, matrix, svg, tel, wifi } from '../../../public/_/qr/lib.js';

test('matrix sizes by version', () => {
  assert.equal(matrix('HELLO', 'L').length, 21); // version 1
  assert.equal(matrix('A'.repeat(100), 'M').length, 4 * 6 + 17);
  assert.ok(matrix('https://6o2f.dev', 'H').length > 21);
  assert.throws(() => matrix('x'.repeat(3000), 'H'));
});
test('finder pattern present', () => {
  const m = matrix('HELLO', 'M');
  const row0 = m[0].slice(0, 7).join(),
    last = m[0].slice(-7).join();
  assert.equal(row0, 'true,true,true,true,true,true,true');
  assert.equal(last, row0);
});
test('utf-8 payload', () => assert.equal(matrix('é✓', 'L').length, 21));
test('payloads', () => {
  assert.equal(wifi({ ssid: 'a;b', pass: 'p:w', sec: 'WPA' }), 'WIFI:T:WPA;S:a\\;b;P:p\\:w;;');
  assert.equal(wifi({ ssid: 'x', sec: 'nopass', hidden: true }), 'WIFI:T:nopass;S:x;H:true;;');
  assert.equal(mailto({ to: 'a@b.c', subject: 'Hi there' }), 'mailto:a@b.c?subject=Hi%20there');
  assert.equal(tel('+61 (400) 000-000'), 'tel:+61400000000');
  assert.equal(tel(' - '), '');
  assert.equal(wifi({ ssid: '' }), '');
  assert.equal(mailto({ to: ' ' }), '');
  assert.equal(mailto({ to: '', subject: 'x' }), 'mailto:?subject=x');
});
test('contrast + svg', () => {
  assert.equal(Math.round(contrast('#000000', '#ffffff')), 21);
  assert.match(contrastWarning('#777777', '#888888'), /Low contrast/);
  assert.match(contrastWarning('#ffffff', '#000000'), /Light modules/);
  assert.equal(contrastWarning('#000000', '#ffffff'), '');
  assert.match(svg(matrix('HELLO', 'L'), { fg: '#000', bg: '#fff', quiet: 4 }), /viewBox="0 0 29 29"/);
});
