import assert from 'node:assert/strict';
import { test } from 'node:test';
import { plan } from './logic.ts';

const q = (s = '') => new URLSearchParams(s);
test('plan', () => {
  assert.deepEqual(plan('418', q()), { status: 418, delay: 0, body: '{"status":418,"ok":false}', json: true, retry: null });
  for (const bad of ['100', '199', '600', 'abc', '20']) assert.equal(typeof plan(bad, q()), 'string');
  assert.equal((plan('204', q('body=x')) as any).body, null);
  assert.equal((plan('200', q('delay=99999')) as any).delay, 10000);
  assert.equal(plan('200', q('delay=x')), 'delay, fail and retry must be numbers');
  assert.equal(typeof plan('200', q('body=' + 'a'.repeat(2049))), 'string');
  assert.equal(typeof plan('200', q('failcode=100')), 'string');
  const f = plan('200', q('fail=1&failcode=503&retry=7'), () => 0.5) as any;
  assert.equal(f.status, 503);
  assert.equal(f.retry, '7');
  assert.equal((plan('200', q('fail=0.5'), () => 0.5) as any).status, 200); // 0.5 < 0.5 is false
  assert.equal((plan('200', q('retry=7')) as any).retry, null);
  const t = plan('200', q('body=hi')) as any;
  assert.equal(t.json, false);
  assert.equal(t.body, 'hi');
  assert.equal((plan('200', q('body=hi&type=json')) as any).json, true);
});
