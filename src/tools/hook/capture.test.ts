import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeBody, MAX_BODY, readCapped, safeHeaders } from './capture.ts';

test('encodeBody text vs base64', () => {
  assert.deepEqual(encodeBody(new TextEncoder().encode('héllo')), { body: 'héllo', encoding: 'text' });
  assert.deepEqual(encodeBody(new Uint8Array([0xff, 0xfe])), { body: '//4=', encoding: 'base64' });
});
test('safeHeaders drops cookie only', () => {
  assert.deepEqual(safeHeaders(new Headers({ cookie: 'a=b', 'x-a': '1' })), { 'x-a': '1' });
});
test('readCapped truncates', async () => {
  const big = new Blob([new Uint8Array(MAX_BODY + 5)]).stream();
  const r = await readCapped(big);
  assert.equal(r.bytes.length, MAX_BODY);
  assert.equal(r.truncated, true);
  assert.equal((await readCapped(null)).truncated, false);
});
