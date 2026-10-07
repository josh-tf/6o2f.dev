import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEY_RE } from './logic.ts';

test('key regex', () => {
  for (const k of ['a', 'my.key-1:x_', 'A'.repeat(100)]) assert.ok(KEY_RE.test(k), k);
  for (const k of ['', 'a b', 'a/b', 'é', 'A'.repeat(101), 'a\n', "x'; DROP"]) assert.ok(!KEY_RE.test(k), k);
});
