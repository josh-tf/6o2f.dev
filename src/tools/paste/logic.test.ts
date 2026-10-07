import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID_RE, newId, ttlSeconds } from './logic.ts';

test('ttl', () => {
  assert.equal(ttlSeconds(undefined), 86400);
  assert.equal(ttlSeconds('30d'), 2592000);
  assert.equal(ttlSeconds('1y'), null);
  assert.equal(ttlSeconds('constructor'), null);
});
test('ids are unique and match ID_RE', () => {
  const ids = new Set(Array.from({ length: 500 }, newId));
  assert.equal(ids.size, 500);
  for (const id of ids) assert.match(id, ID_RE);
});
