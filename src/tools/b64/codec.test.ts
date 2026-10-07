import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore no types for the browser module
import { decode, decodeBytes, encode, hex } from '../../../public/_/b64/codec.js';

test('utf-8 round trip, url-safe, unpadded', () => {
  const t = 'héllo ✓ 😀 ?>>';
  assert.equal(decode(encode(t)), t);
  const u = encode('?>>?>>', { url: true, pad: false });
  assert.match(u, /^[A-Za-z0-9_-]+$/);
  assert.equal(decode(u), '?>>?>>');
  assert.equal(encode('a'), 'YQ==');
  assert.equal(encode('a', { pad: false }), 'YQ');
  assert.equal(decode('  YW\nJj '), 'abc');
});
test('large input does not overflow the stack', () => {
  const big = 'x'.repeat(2_000_000);
  assert.equal(decode(encode(big)), big);
});
test('errors and binary', () => {
  assert.throws(() => decode('a$b='), /unexpected character "\$" at position 2/);
  assert.throws(() => decode('A'), /impossible/);
  assert.throws(() => decode('/w=='), /Decoded 1 byte is not valid UTF-8/);
  assert.equal(hex(decodeBytes('/wAB')), 'ff 00 01');
  assert.equal(hex(new Uint8Array(17)).split('\n').length, 2);
});
