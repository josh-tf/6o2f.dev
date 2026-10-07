import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanHeaders } from './logic.ts';

test('cleanHeaders', () => {
  assert.deepEqual(
    cleanHeaders([
      { name: 'Authorization', value: 'Bearer x' },
      { name: '', value: '' },
    ]),
    [['Authorization', 'Bearer x']],
  );
  for (const n of ['Host', 'cookie', 'Content-Length', 'connection', 'Transfer-Encoding'])
    assert.match(String(cleanHeaders([{ name: n, value: '1' }])), /not allowed/);
  assert.match(String(cleanHeaders([{ name: 'a b', value: '1' }])), /Invalid/);
  assert.match(String(cleanHeaders([{ name: 'X', value: 'a\r\nHost: x' }])), /Invalid/);
});
