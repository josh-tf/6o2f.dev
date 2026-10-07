import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore no types for the browser module
import { randInt, randRange, shuffle } from '../../../public/_/random/lib.js';
// @ts-ignore
import { parseDice, roll } from '../../../public/_/random/dice.js';

test('randInt rejects the biased tail instead of using modulo', () => {
  // n=3: 2^32 % 3 = 1, so 0xFFFFFFFF is the one value that must be rejected.
  const seq = [0xffffffff, 5];
  assert.equal(
    randInt(3, (a: Uint32Array) => {
      a[0] = seq.shift()!;
    }),
    2,
  );
  assert.equal(seq.length, 0);
  // 64-bit path: n = 2^40+1 is above 2^32.
  const big = [2n ** 64n - 1n, 7n];
  assert.equal(
    randInt(2 ** 40 + 1, (a: BigUint64Array) => {
      a[0] = big.shift()!;
    }),
    7,
  );
});

test('randInt is uniform and in range', () => {
  const c = new Array(6).fill(0);
  for (let i = 0; i < 60000; i++) c[randInt(6)]++;
  for (const x of c) assert.ok(x > 9000 && x < 11000, String(c));
  assert.throws(() => randInt(0));
  assert.equal(randInt(1), 0);
});

test('randRange inclusive, shuffle is a permutation', () => {
  const seen = new Set<number>();
  for (let i = 0; i < 500; i++) seen.add(randRange(-2, 2));
  assert.deepEqual(
    [...seen].sort((a, b) => a - b),
    [-2, -1, 0, 1, 2],
  );
  assert.deepEqual(
    shuffle([1, 2, 3, 4, 5]).sort((a: number, b: number) => a - b),
    [1, 2, 3, 4, 5],
  );
});

test('dice notation', () => {
  assert.deepEqual(parseDice('3d6+2'), { n: 3, m: 6, k: 2 });
  assert.deepEqual(parseDice(' D20 '), { n: 1, m: 20, k: 0 });
  assert.deepEqual(parseDice('2d10 - 3'), { n: 2, m: 10, k: -3 });
  for (const bad of ['', 'd', '3d', '0d6', '3d0', '1001d6', 'abc', '3d6+']) assert.equal(parseDice(bad), null, bad);
  const r = roll(parseDice('4d6+2')!);
  assert.equal(r.rolls.length, 4);
  assert.ok(r.rolls.every((x: number) => x >= 1 && x <= 6));
  assert.equal(r.total, r.rolls.reduce((a: number, b: number) => a + b, 0) + 2);
});
