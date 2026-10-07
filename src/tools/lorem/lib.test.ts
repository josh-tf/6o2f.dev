import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { generate, prng } from '../../../public/_/lorem/lib.js';

test('prng is deterministic and in range', () => {
  const a = prng(42),
    b = prng(42);
  for (let i = 0; i < 50; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
  assert.notEqual(prng(1)(), prng(2)());
});
test('same seed, same text; different seed differs', () => {
  assert.equal(generate({ seed: 'x' }), generate({ seed: 'x' }));
  assert.notEqual(generate({ seed: 1 }), generate({ seed: 2 }));
});
test('counts and start', () => {
  assert.equal(generate({ kind: 'words', count: 12, seed: 3 }).split(' ').length, 12);
  assert.equal(generate({ kind: 'words', count: 3 }), 'lorem ipsum dolor');
  assert.equal(generate({ kind: 'sentences', count: 4, seed: 5 }).match(/\./g)!.length, 4);
  assert.equal(generate({ kind: 'paragraphs', count: 4, seed: 5 }).split('\n\n').length, 4);
  assert.ok(generate({ start: true, seed: 9 }).startsWith('Lorem ipsum dolor sit amet, consectetur adipiscing elit'));
  assert.ok(!generate({ start: false, seed: 9, kind: 'words', count: 8 }).startsWith('lorem ipsum dolor sit amet'));
});
test('html wraps paragraphs', () => {
  const h = generate({ count: 2, html: true, seed: 1 }).split('\n');
  assert.equal(h.length, 2);
  assert.ok(h.every((l: string) => l.startsWith('<p>') && l.endsWith('</p>')));
});
