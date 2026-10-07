import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore no types for the browser module
import { slugify } from '../../../public/_/slug/lib.js';

test('basics', () => {
  assert.equal(slugify('Hello, World!'), 'hello-world');
  assert.equal(slugify('  --Hello___ World--  '), 'hello-world');
  assert.equal(slugify(''), '');
  assert.equal(slugify('!!!'), '');
  assert.equal(slugify("Don't Stop ’Til 2024"), 'dont-stop-til-2024');
  assert.equal(slugify('Rock & Roll'), 'rock-and-roll');
});
test('options', () => {
  assert.equal(slugify('Hello World', { sep: '_' }), 'hello_world');
  assert.equal(slugify('Hello World', { sep: '' }), 'helloworld');
  assert.equal(slugify('Hello World', { lower: false }), 'Hello-World');
  assert.equal(slugify('The Art of the Deal', { stop: true }), 'art-deal');
  assert.equal(slugify('The And', { stop: true }), 'the-and'); // not emptied
});
test('accents and transliteration', () => {
  assert.equal(slugify('Crème Brûlée à la Française'), 'creme-brulee-a-la-francaise');
  assert.equal(slugify('école'), 'ecole'); // decomposed input
  assert.equal(slugify('Straße Æble Øl Łódź'), 'strasse-aeble-ol-lodz');
  assert.equal(slugify('Über café', { accents: false }), 'über-café');
  assert.equal(slugify('日本語 abc', { accents: false }), '日本語-abc');
  assert.equal(slugify('日本語 abc'), 'abc');
});
test('max length cuts at a word boundary', () => {
  assert.equal(slugify('the quick brown fox', { max: 12 }), 'the-quick');
  assert.equal(slugify('the quick brown fox', { max: 15 }), 'the-quick-brown');
  assert.equal(slugify('the quick brown fox', { max: 9 }), 'the-quick');
  assert.equal(slugify('the quick brown fox', { max: 8 }), 'the');
  assert.equal(slugify('supercalifragilistic', { max: 5 }), 'super');
  assert.equal(slugify('a b', { sep: '', max: 1 }), 'a');
});
