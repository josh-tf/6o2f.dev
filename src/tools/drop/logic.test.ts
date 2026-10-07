// @ts-nocheck node types are not in the Worker tsconfig
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanName, disposition, newId, ttlMs } from './logic.ts';

test('cleanName', () => {
  assert.equal(cleanName('../a/b\\c\x00d.zip'), '..abcd.zip');
  assert.equal(cleanName('x'.repeat(300)).length, 100);
  assert.equal(cleanName(undefined), 'file');
  assert.equal(cleanName('/'), 'file');
});
test('ttl', () => {
  assert.equal(ttlMs(undefined), 86400e3);
  assert.equal(ttlMs('1h'), 3600e3);
  assert.equal(ttlMs('5y'), undefined);
  for (const k of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) assert.equal(ttlMs(k), undefined);
});
test('disposition + id', () => {
  assert.equal(disposition("a b'(é).txt"), "attachment; filename*=UTF-8''a%20b%27%28%C3%A9%29.txt");
  assert.match(newId(), /^[\w-]{24}$/);
});
