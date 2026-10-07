import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore no types for the browser module
import { password, passphrase, bits, phraseBits, verdict, sets } from '../../../public/_/password/lib.js';
// @ts-ignore
import WORDS from '../../../public/_/password/words.js';

test('wordlist is 1296 unique lowercase words', () => {
  assert.equal(WORDS.length, 1296);
  assert.equal(new Set(WORDS).size, 1296);
  assert.ok(WORDS.every((w: string) => /^[a-z]+(-[a-z]+)?$/.test(w)));
});

test('password honours length, sets and look-alikes', () => {
  for (let i = 0; i < 300; i++) {
    const p = password(12, ['lower', 'upper', 'digits', 'symbols'], true);
    assert.equal(p.length, 12);
    assert.ok(!/[Il1O0o|]/.test(p), p);
    assert.ok(/[a-z]/.test(p) && /[A-Z]/.test(p) && /[0-9]/.test(p) && /[^a-zA-Z0-9]/.test(p), p);
  }
  assert.match(password(128, ['digits'], false), /^\d{128}$/);
  assert.throws(() => password(10, [], false));
});

test('entropy', () => {
  assert.ok(Math.abs(bits(94, 10) - 65.54) < 0.01);
  assert.ok(Math.abs(phraseBits(6, false) - 62.04) < 0.01);
  assert.ok(Math.abs(phraseBits(4, true) - (4 * Math.log2(1296) + Math.log2(100))) < 1e-9);
  assert.equal(verdict(30)[0], 'Weak');
  assert.equal(verdict(100)[0], 'Very strong');
  assert.equal(sets(['digits'], true)[0], '23456789');
});

test('passphrase shape', () => {
  const p = passphrase(5, { sep: ' ', cap: true, num: true }).split(' ');
  assert.equal(p.length, 6);
  assert.match(p[0], /^[A-Z]/);
  assert.match(p[5], /^\d\d$/);
});
