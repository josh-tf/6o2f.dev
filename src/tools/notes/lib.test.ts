import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore plain JS module
import { label, matches, merge, newNote, parseImport } from '../../../public/_/notes/lib.js';

test('search and label', () => {
  const n = newNote('Groceries', 'milk\neggs');
  assert.ok(matches(n, 'EGGS') && matches(n, '') && !matches(n, 'bread'));
  assert.equal(label(newNote('', 'first line\nsecond')), 'first line');
  assert.equal(label(newNote()), 'Untitled');
});
test('import', () => {
  const a = parseImport('{"notes":[{"id":"x","title":"T","body":"B","updated":5},null,{"body":7}]}');
  assert.equal(a.length, 2);
  assert.equal(a[0].id, 'x');
  assert.equal(a[1].body, '7');
  assert.throws(() => parseImport('{"a":1}'));
  assert.throws(() => parseImport('nope'), /not valid JSON/);
  assert.deepEqual(
    merge([{ id: 'x', title: 'old' }, { id: 'y' }], [{ id: 'x', title: 'new' }]).map((n: any) => n.title ?? n.id),
    ['y', 'new'],
  );
});
