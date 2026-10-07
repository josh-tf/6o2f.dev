import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { analyze, category, parseFind, utf8, utf16, graphemes } from '../../../public/_/unicode/lib.js';

test('encodings', () => {
  assert.equal(utf8('€'), 'E2 82 AC');
  assert.equal(utf16('😀'), 'D83D DE00');
  assert.equal(utf16('A'), '0041');
});
test('grapheme aware', () => {
  assert.equal(graphemes('éa').length, 2);
  assert.equal(graphemes('👨‍👩‍👧').length, 1);
  const [r] = analyze('é');
  assert.equal(r.cp, 'U+0065 U+0301');
  assert.match(r.cat, /Letter \(Ll\), Mark \(Mn\)/);
});
test('categories', () => {
  assert.equal(category(0x41), 'Letter (Lu)');
  assert.equal(category(0x35), 'Number (Nd)');
  assert.equal(category(0x21), 'Punctuation (Po)');
  assert.equal(category(0x24), 'Symbol (Sc)');
  assert.equal(category(0x20), 'Separator (Zs)');
  assert.equal(category(0x0), 'Control (Cc)');
});
test('flags', () => {
  const f = (s: string) =>
    analyze(s)
      .flatMap((r: any) => r.flags)
      .join('|');
  assert.match(f('a​b'), /zero-width space/);
  assert.match(f('﻿'), /BOM/);
  assert.match(f('a‮b'), /bidi override/);
  assert.match(f('a b'), /non-breaking/);
  assert.match(f('pаypal'), /lookalike/); // Cyrillic а in a Latin word
  assert.equal(f('привет'), ''); // all Cyrillic: nothing to confuse
  assert.equal(f('hello world'), '');
  assert.equal(f('👨‍👩‍👧'), ''); // ZWJ inside an emoji is fine
  assert.match(f('a‍b'), /zero-width joiner/);
});
test('parseFind', () => {
  assert.deepEqual(parseFind('U+1F600'), [0x1f600]);
  assert.deepEqual(parseFind('u+41'), [0x41]);
  assert.deepEqual(parseFind('1F600'), [0x1f600]);
  assert.deepEqual(parseFind('0x20AC'), [0x20ac]);
  assert.deepEqual(parseFind('é'), [0xe9]);
  assert.deepEqual(parseFind('a'), [0x61]);
  assert.equal(parseFind('U+FFFFFF'), null);
  assert.equal(parseFind(' '), null);
});
test('clean strips invisibles but keeps emoji joiners', async () => {
  // @ts-ignore
  const { clean } = await import('../../../public/_/unicode/lib.js');
  assert.equal(clean('a​b‮c﻿d'), 'abcd');
  assert.equal(clean('a b　c'), 'a b c');
  assert.equal(clean('👨‍👩‍👧 ❤️'), '👨‍👩‍👧 ❤️');
  assert.equal(clean('tab\there\nnew\x07'), 'tab\there\nnew');
  assert.equal(clean('wоrld'), 'wоrld'); // lookalikes are only flagged
});
