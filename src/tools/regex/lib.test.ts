import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { execAll, segments } from '../../../public/_/regex/lib.js';

test('groups, named groups, replace', () => {
  const r = execAll('(?<k>\\w)=(\\d)', 'g', 'a=1 b=2', '$2$<k>');
  assert.equal(r.matches.length, 2);
  assert.deepEqual(r.matches[1], { index: 4, text: 'b=2', groups: ['b', '2'], named: { k: 'b' } });
  assert.equal(r.replaced, '1a 2b');
});
test('empty matches terminate; non-global stops at one', () => {
  assert.equal(execAll('x*', 'g', 'ab').matches.length, 3);
  assert.equal(execAll('a', '', 'aaa').matches.length, 1);
  assert.equal(execAll('a', 'y', 'aab').matches.length, 2);
});
test('bad pattern throws; segments', () => {
  assert.throws(() => execAll('(', '', 'x'), SyntaxError);
  const s = segments('ab-cd', execAll('\\w+', 'g', 'ab-cd').matches);
  assert.deepEqual(
    s.map((x: any) => x.text + x.hit),
    ['abtrue', '-false', 'cdtrue'],
  );
});
