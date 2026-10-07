import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore plain JS module
import { counts, filterItems, move, moveTo, newItem, parseImport } from '../../../public/_/todo/lib.js';

const mk = (...t: string[]) => t.map((x) => newItem(x));
test('filter and counts', () => {
  const l = mk('a', 'b', 'c');
  l[1].done = true;
  assert.deepEqual(counts(l), { all: 3, done: 1, active: 2 });
  assert.deepEqual(
    filterItems(l, 'done').map((i: any) => i.text),
    ['b'],
  );
  assert.equal(filterItems(l, 'active').length, 2);
});
test('move', () => {
  const l = mk('a', 'b', 'c', 'd');
  const t = (x: any[]) => x.map((i) => i.text).join('');
  assert.equal(t(move(l, l[2].id, -1)), 'acbd');
  assert.equal(t(move(l, l[0].id, -1)), 'abcd');
  assert.equal(t(move(l, l[3].id, 1)), 'abcd');
  assert.equal(t(move(l, l[0].id, 1, [l[0].id, l[2].id])), 'bcad'); // skips hidden b
  assert.equal(t(moveTo(l, l[3].id, l[0].id)), 'dabc');
});
test('import', () => {
  const r = parseImport('{"items":[{"text":" x ","done":true},{"text":" "},5]}');
  assert.equal(r.length, 1);
  assert.equal(r[0].text, 'x');
  assert.equal(r[0].done, true);
  assert.throws(() => parseImport('[1'), /not valid JSON/);
  assert.throws(() => parseImport('{}'));
});
