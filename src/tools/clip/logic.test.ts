import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID_RE, byteLength, newId, ttlSeconds } from './logic.ts';

test('ids sort newest first and match the route regex', () => {
  const a = newId(1_700_000_000_000),
    b = newId(1_700_000_001_000);
  assert.ok(ID_RE.test(a) && ID_RE.test(b));
  assert.ok(b < a);
});
test('ttl and size', () => {
  assert.equal(ttlSeconds('10m'), 600);
  assert.equal(ttlSeconds(undefined), 3600);
  assert.equal(ttlSeconds('1w'), undefined);
  assert.equal(ttlSeconds('constructor'), undefined);
  assert.equal(ttlSeconds('toString'), undefined);
  assert.equal(byteLength('é'), 2);
});
