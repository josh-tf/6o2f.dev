import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCreate, validateChoices, voterHash, newId, tally, canSeeResults, makeLimiter } from './logic.ts';

const NOW = 1_700_000_000_000;
test('create validation', () => {
  const ok = validateCreate({ question: ' Lunch? ', options: ['Pizza', ' Sushi ', ''], multi: true }, NOW);
  assert.deepEqual(ok, { question: 'Lunch?', options: ['Pizza', 'Sushi'], multi: true, showResults: true, closesAt: NOW + 7 * 86_400_000 });
  assert.equal(typeof validateCreate({ question: '', options: ['a', 'b'] }, NOW), 'string');
  assert.equal(typeof validateCreate({ question: 'q', options: ['a'] }, NOW), 'string');
  assert.equal(typeof validateCreate({ question: 'q', options: Array.from({ length: 11 }, (_, i) => `o${i}`) }, NOW), 'string');
  assert.equal(typeof validateCreate({ question: 'q', options: ['a', 'A'] }, NOW), 'string');
  assert.equal(typeof validateCreate({ question: 'q', options: ['a', 'b'], days: 31 }, NOW), 'string');
  assert.equal(typeof validateCreate({ question: 'q', options: ['a', 'b'], days: 0 }, NOW), 'string');
  assert.equal(typeof validateCreate({ question: 'q', options: ['a', 'x'.repeat(101)] }, NOW), 'string');
  assert.equal(typeof validateCreate(null, NOW), 'string');
  assert.equal((validateCreate({ question: 'q', options: ['a', 'b'], days: 30, showResults: false }, NOW) as any).showResults, false);
});
test('ballot validation', () => {
  assert.deepEqual(validateChoices([1], 3, false), [1]);
  assert.deepEqual(validateChoices([2, 0], 3, true), [0, 2]);
  for (const bad of [[], [0, 1], [3], [-1], [1.5], ['1'], 'x', null]) assert.equal(typeof validateChoices(bad, 3, false), 'string');
  assert.equal(typeof validateChoices([1, 1], 3, true), 'string');
  assert.equal(typeof validateChoices([0, 1, 2, 3], 3, true), 'string');
});
test('voter hash is stable, scoped and hides the ip', async () => {
  const a = await voterHash('s', 'p1', '1.2.3.4', 'UA');
  assert.equal(a, await voterHash('s', 'p1', '1.2.3.4', 'UA'));
  assert.notEqual(a, await voterHash('s', 'p2', '1.2.3.4', 'UA'));
  assert.notEqual(a, await voterHash('s', 'p1', '1.2.3.5', 'UA'));
  assert.notEqual(a, await voterHash('t', 'p1', '1.2.3.4', 'UA'));
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.ok(!a.includes('1.2.3.4'));
});
test('ids', () => {
  const ids = new Set(Array.from({ length: 200 }, () => newId()));
  assert.equal(ids.size, 200);
  for (const i of ids) assert.match(i, /^[a-z2-9]{8}$/);
});
test('tally and visibility', () => {
  assert.deepEqual(
    tally(
      3,
      [
        { i: 0, n: 2 },
        { i: 2, n: 1 },
        { i: 9, n: 5 },
      ],
      3,
    ),
    { voters: 3, counts: [2, 0, 1], percents: [67, 0, 33] },
  );
  assert.deepEqual(tally(2, [], 0).percents, [0, 0]);
  assert.equal(canSeeResults({ show_results: 0, closes_at: NOW + 1 }, NOW), false);
  assert.equal(canSeeResults({ show_results: 0, closes_at: NOW }, NOW), true);
  assert.equal(canSeeResults({ show_results: 1, closes_at: NOW + 1 }, NOW), true);
});
test('limiter allows N per window', () => {
  const l = makeLimiter(3, 1000);
  assert.deepEqual(
    [1, 2, 3, 4].map(() => l('k', 0)),
    [true, true, true, false],
  );
  assert.equal(l('k', 2000), true);
  assert.equal(l('other', 0), true);
});
