import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CODE_RE, networkKey, nearbyRoomId, roomId } from './room-id.ts';

test('networkKey groups IPv6 by /64 and leaves IPv4 alone', () => {
  assert.equal(networkKey('203.0.113.9'), '203.0.113.9');
  assert.equal(networkKey(undefined), 'dev');
  assert.equal(networkKey('2001:db8:1:2:aaaa:bbbb:cccc:dddd'), '2001:db8:1:2');
  assert.equal(networkKey('2001:0DB8:0001:0002::1'), '2001:db8:1:2');
  assert.equal(networkKey('2001:db8::1'), '2001:db8:0:0');
  assert.equal(networkKey('::1'), '0:0:0:0');
  assert.equal(networkKey('::ffff:1.2.3.4'), '1.2.3.4');
  assert.equal(networkKey('2001:db8:1:2::5'), networkKey('2001:db8:1:2:9:9:9:9'));
});
test('nearbyRoomId is deterministic, 16 hex, per network and per secret', async () => {
  const a = await nearbyRoomId('1.2.3.4', 's');
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(a, await nearbyRoomId('1.2.3.4', 's'));
  assert.notEqual(a, await nearbyRoomId('1.2.3.5', 's'));
  assert.notEqual(a, await nearbyRoomId('1.2.3.4', 't'));
  assert.equal(await nearbyRoomId('2001:db8:1:2::1', 's'), await nearbyRoomId('2001:db8:1:2::2', 's'));
});
test('roomId validates codes', async () => {
  assert.equal(await roomId({ code: 'ABC234' }, null, 's'), 'c:ABC234');
  for (const bad of ['abc234', 'ABC23', 'ABC2345', 'ABCO23', 'ABCI23', 'ABC231', 'ABC230', '']) assert.equal(await roomId({ code: bad }, null, 's'), null, bad);
  assert.equal(await roomId({}, null, 's'), null);
  assert.match((await roomId({ mode: 'nearby' }, null, 's'))!, /^[0-9a-f]{16}$/);
  assert.ok(CODE_RE.test('HJKMNP'));
});
