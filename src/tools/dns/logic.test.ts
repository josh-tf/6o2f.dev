import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanName, diff, parseDoh, reverseName } from './logic.ts';

test('reverseName', () => {
  assert.equal(reverseName('1.2.3.4'), '4.3.2.1.in-addr.arpa');
  assert.equal(reverseName('2001:db8::1'), '1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa');
  assert.equal(reverseName('256.1.1.1'), null);
  assert.equal(reverseName('example.com'), null);
});
test('cleanName', () => {
  assert.equal(cleanName('Example.COM.'), 'example.com');
  assert.equal(cleanName('_dmarc.example.com'), '_dmarc.example.com');
  assert.equal(cleanName('8.8.8.8'), '8.8.8.8.in-addr.arpa');
  for (const bad of ['', 'a..b', '-a.com', 'a b.com', 'a.com/x', 'a'.repeat(64) + '.com', 'a.'.repeat(130) + 'com']) assert.equal(cleanName(bad), null, bad);
});
test('parseDoh + diff', () => {
  const a = parseDoh({ Status: 0, AD: true, Answer: [{ name: 'x.com.', type: 1, TTL: 5, data: '1.1.1.1' }] });
  assert.deepEqual(a, { status: 'NOERROR', ad: true, answers: [{ name: 'x.com', type: 'A', ttl: 5, data: '1.1.1.1' }] });
  assert.equal(parseDoh({ Status: 3 }).status, 'NXDOMAIN');
  assert.deepEqual(diff(a, { ...a, answers: [{ ...a.answers[0], ttl: 9 }] }), []);
  assert.equal(diff(a, parseDoh({ Status: 0, Answer: [{ name: 'x.com.', type: 1, TTL: 5, data: '2.2.2.2' }] })).length, 3);
});
