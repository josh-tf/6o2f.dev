import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore no types for the browser module
import { decode, status, verifyHS } from '../../../public/_/jwt/jwt.js';

// jwt.io sample token, secret "your-256-bit-secret"
const T =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
test('decode + verify', async () => {
  const d = decode('Bearer ' + T);
  assert.equal(d.payload.name, 'John Doe');
  assert.equal(d.header.alg, 'HS256');
  assert.equal(await verifyHS('HS256', d.input, d.sig, 'your-256-bit-secret'), true);
  assert.equal(await verifyHS('HS256', d.input, d.sig, 'nope'), false);
  await assert.rejects(verifyHS('RS256', d.input, d.sig, 'x'), /not verified/);
});
test('utf-8 payload and errors', () => {
  const b = (o: unknown) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o))))
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  assert.equal(decode(`${b({ alg: 'none' })}.${b({ n: 'é✓' })}.`).payload.n, 'é✓');
  assert.throws(() => decode('a.b'), /3 dot/);
  assert.throws(() => decode('!!.e30.x'), /header/);
});
test('status', () => {
  assert.deepEqual(status('exp', 1000 + 3 * 3600, 1000), { ok: true, text: 'valid for 3h' });
  assert.equal(status('exp', 0, 7200).text, 'expired 2h ago');
});
test('whitespace inside token, base64 secret, years', async () => {
  const d = decode(T.slice(0, 40) + '\n  ' + T.slice(40));
  assert.equal(d.payload.sub, '1234567890');
  const b64 = btoa('your-256-bit-secret');
  assert.equal(await verifyHS('HS256', d.input, d.sig, b64, true), true);
  await assert.rejects(verifyHS('HS256', d.input, d.sig, '%%', true), /not valid Base64/);
  assert.equal(status('exp', 0, 3 * 31557600).text, 'expired 3.0y ago');
  assert.equal(status('iat', 0, 400 * 86400).text, 'issued 400d ago');
});
