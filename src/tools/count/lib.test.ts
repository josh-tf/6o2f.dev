import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore no types for the browser module
import { count, duration, topWords, wordList } from '../../../public/_/count/lib.js';

test('counts', () => {
  const c = count('Hello, world! This is 1 test.\n\nSecond paragraph here');
  assert.deepEqual(c, { words: 9, chars: 52, charsNoSpace: 43, lines: 3, sentences: 3, paragraphs: 2, bytes: 52 });
  assert.deepEqual(count(''), { words: 0, chars: 0, charsNoSpace: 0, lines: 0, sentences: 0, paragraphs: 0, bytes: 0 });
  assert.equal(count('a\nb\n').lines, 2);
  assert.equal(count('3.14 is pi. ok').sentences, 2);
});
test('graphemes and bytes', () => {
  const c = count('é \u{1F468}‍\u{1F469}‍\u{1F467} \u{1F1E6}\u{1F1FA}');
  assert.equal(c.chars, 5); // e+accent, space, family, space, flag
  assert.equal(c.bytes, new TextEncoder().encode('é \u{1F468}‍\u{1F469}‍\u{1F467} \u{1F1E6}\u{1F1FA}').length);
  assert.equal(count('héllo').bytes, 6);
});
test('words', () => assert.deepEqual(wordList("Don't stop, rock-n-roll 42"), ["Don't", 'stop', 'rock', 'n', 'roll', '42']));
test('durations', () => {
  assert.equal(duration(100, 200), '30 sec');
  assert.equal(duration(650, 200), '3 min 15 sec');
  assert.equal(duration(400, 200), '2 min');
  assert.equal(duration(0, 130), '0 sec');
});
test('top words', () => {
  const t = 'The cat and the dog. THE end, cat!';
  assert.deepEqual(topWords(t, false), [
    ['the', 3],
    ['cat', 2],
    ['and', 1],
    ['dog', 1],
    ['end', 1],
  ]);
  assert.deepEqual(topWords(t, true), [
    ['cat', 2],
    ['dog', 1],
    ['end', 1],
  ]);
  assert.equal(topWords('a b c d e f g h i j k l m', false).length, 10);
});
