import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
// @ts-ignore no types for the browser module
import { md5, hex, b64url, hmac, digest, matches } from '../../../public/_/hash/lib.js';

const enc = (s: string) => new TextEncoder().encode(s);

test('MD5 matches RFC 1321 test vectors', () => {
  const v: [string, string][] = [
    ['', 'd41d8cd98f00b204e9800998ecf8427e'],
    ['a', '0cc175b9c0f1b6a831c399e269772661'],
    ['abc', '900150983cd24fb0d6963f7d28e17f72'],
    ['message digest', 'f96b697d7cb7938d525a2f31aaf161d0'],
    ['abcdefghijklmnopqrstuvwxyz', 'c3fcd3d76192e4007dfb496cca67e13b'],
    ['ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 'd174ab98d277d9f5a5611c2c9f419d9f'],
    ['12345678901234567890123456789012345678901234567890123456789012345678901234567890', '57edf4a22be3c955ac49da2e2107b67a'],
  ];
  for (const [s, h] of v) assert.equal(hex(md5(enc(s))), h, s);
});

test('MD5 agrees with node across padding boundaries', () => {
  for (const n of [55, 56, 57, 63, 64, 65, 119, 120, 1000]) {
    const d = new Uint8Array(n).map((_, i) => i * 7);
    assert.equal(hex(md5(d)), createHash('md5').update(d).digest('hex'), String(n));
  }
});

test('HMAC (incl. MD5 and long keys) matches node', async () => {
  for (const alg of ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'])
    for (const key of ['key', 'k'.repeat(100)]) {
      const exp = createHmac(alg.replace('-', '').toLowerCase(), key).update('The quick brown fox').digest('hex');
      assert.equal(hex(await hmac(alg, enc(key), enc('The quick brown fox'))), exp, alg + key.length);
    }
});

test('digest + compare', async () => {
  const d = await digest('SHA-256', enc('abc'));
  assert.equal(hex(d), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.ok(matches(d, ' BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD\n'));
  assert.ok(matches(d, b64url(d)));
  assert.ok(!matches(d, 'ba78'));
  assert.ok(!matches(d, ''));
});
