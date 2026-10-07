import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { caesar, rot13, rot47, atbash, vigenere, railFence, affine, bruteForce, englishScore } from '../../../public/_/rot/lib.js';

test('rot13 / rot47 are involutions and keep case and punctuation', () => {
  assert.equal(rot13('Hello, World!'), 'Uryyb, Jbeyq!');
  assert.equal(rot13(rot13('Why did the chicken cross the road?')), 'Why did the chicken cross the road?');
  assert.equal(rot47('Hello, World!'), 'w6==@[ (@C=5P');
  assert.equal(rot47(rot47('The quick brown fox ~!')), 'The quick brown fox ~!');
});
test('caesar shifts, negative and large shifts, case kept', () => {
  assert.equal(caesar('Attack at Dawn!', 3), 'Dwwdfn dw Gdzq!');
  assert.equal(caesar('Dwwdfn dw Gdzq!', -3), 'Attack at Dawn!');
  assert.equal(caesar('xyz', 29), 'abc');
  assert.equal(caesar('ÀÉ 123', 5), 'ÀÉ 123');
});
test('atbash', () => {
  assert.equal(atbash('Hello'), 'Svool');
  assert.equal(atbash(atbash('Wizard, 42')), 'Wizard, 42');
});
test('vigenere known vectors', () => {
  assert.equal(vigenere('ATTACKATDAWN', 'LEMON'), 'LXFOPVEFRNHR');
  assert.equal(vigenere('LXFOPVEFRNHR', 'LEMON', true), 'ATTACKATDAWN');
  assert.equal(vigenere('Attack at dawn!', 'lemon'), 'Lxfopv ef rnhr!');
  assert.equal(vigenere('Lxfopv ef rnhr!', 'Le-mon 1', true), 'Attack at dawn!');
  assert.equal(vigenere('x', '123'), null);
});
test('rail fence', () => {
  assert.equal(railFence('WEAREDISCOVEREDFLEEATONCE', 3), 'WECRLTEERDSOEEFEAOCAIVDEN');
  assert.equal(railFence('WECRLTEERDSOEEFEAOCAIVDEN', 3, true), 'WEAREDISCOVEREDFLEEATONCE');
  for (const r of [2, 3, 4, 7, 40]) for (const t of ['a', 'ab', 'Hello, World! 😀 ok']) assert.equal(railFence(railFence(t, r), r, true), t);
  assert.equal(railFence('abc', 1), 'abc');
});
test('affine known vector and invalid a', () => {
  assert.equal(affine('AFFINE CIPHER', 5, 8), 'IHHWVC SWFRCP');
  assert.equal(affine('IHHWVC SWFRCP', 5, 8, true), 'AFFINE CIPHER');
  assert.equal(affine('abc', 2, 3), null);
  assert.equal(affine('Hello', 1, 0), 'Hello');
});
test('brute force finds the English shift', () => {
  const ct = caesar('The quick brown fox jumps over the lazy dog and keeps running home.', 11);
  const { rows, best } = bruteForce(ct);
  assert.equal(rows.length, 25);
  assert.equal(rows[best].shift, 11);
  assert.equal(rows[best].text, 'The quick brown fox jumps over the lazy dog and keeps running home.');
  assert.equal(bruteForce('12 !').best, -1);
  assert.equal(englishScore('1234'), Infinity);
});
