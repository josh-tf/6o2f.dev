import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore no types for the browser module
import { diff, diffSeq, fold, words } from '../../../public/_/diff/lcs.js';

test('line diff counts and pairing', () => {
  const d = diff('a\nb\nc\n', 'a\nB\nc\nd');
  assert.deepEqual(
    d.rows.map((r: any) => r.t),
    ['eq', 'chg', 'eq', 'add'],
  );
  assert.equal(d.added, 2);
  assert.equal(d.removed, 1);
});
test('ignore whitespace', () => {
  assert.equal(diff('a  b\n c', 'a b\nc', { ignoreWs: true }).added, 0);
  assert.equal(diff('a  b', 'a b').added, 1);
});
test('words highlight only the changed token', () => {
  const w = words('the quick fox', 'the slow fox');
  assert.deepEqual(
    w.a.filter((s: any) => s.changed).map((s: any) => s.text),
    ['quick'],
  );
  assert.deepEqual(
    w.b.filter((s: any) => s.changed).map((s: any) => s.text),
    ['slow'],
  );
});
test('empty sides and LCS minimality', () => {
  assert.equal(diff('', 'x\ny').added, 2);
  assert.equal(diffSeq([...'ABCBDAB'], [...'BDCABA']).filter((o: any) => o.t === 'eq').length, 4);
});
test('fold keeps context around changes', () => {
  const a = Array.from({ length: 20 }, (_, i) => `l${i}`);
  const b = a.slice();
  b[10] = 'X';
  const f = fold(diff(a.join('\n'), b.join('\n')).rows, 3);
  assert.deepEqual(
    f.map((r: any) => (r.t === 'skip' ? `skip${r.count}` : r.t)),
    ['skip7', 'eq', 'eq', 'eq', 'chg', 'eq', 'eq', 'eq', 'skip6'],
  );
  assert.equal(fold(diff('a\nb', 'a\nc').rows).length, 2); // short runs stay
  assert.equal(fold(diff('a\nb\nc', 'a\nb\nc').rows, 0)[0].count, 3);
});
