import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ipKey, isTrap, maze, MAZE } from './guard.ts';

test('trap paths', () => {
  for (const p of [
    '/.env',
    '/.git/config',
    '/wp-login.php',
    '/wp-admin/setup.php',
    '/xmlrpc.php',
    '/phpmyadmin/',
    '/vendor/phpunit/x',
    '/__maze/abc',
    '/backup.sql',
    '/.hg/dirstate',
    '/.bzr/branch',
    '/.idea/workspace.xml',
    '/.npmrc',
  ])
    assert.ok(isTrap(p), p);
  for (const p of ['/', '/api/tools', '/p/abc123', '/h/xyz', '/environment', '/d/abc/file.env', '/wp', '/robots.txt']) assert.ok(!isTrap(p), p);
});

test('ipKey: IPv4 as is, IPv6 as /64', () => {
  assert.equal(ipKey('203.0.113.9'), '203.0.113.9');
  assert.equal(ipKey('2001:db8:abcd:12::1'), '2001:db8:abcd:12::/64');
  assert.equal(ipKey('2001:0db8:0000:0012:aaaa:bbbb:cccc:dddd'), '2001:db8:0:12::/64');
  assert.equal(ipKey('2001:db8::5'), '2001:db8:0:0::/64');
  assert.equal(ipKey('::1'), '0:0:0:0::/64');
});

test('maze pages are deterministic and link deeper', async () => {
  const a = await (await maze(`${MAZE}seed`)).text(),
    b = await (await maze(`${MAZE}seed`)).text();
  assert.equal(a, b);
  assert.equal((a.match(new RegExp(`href="${MAZE}[0-9a-f]{8}"`, 'g')) ?? []).length, 8);
  assert.match(a, /noindex/);
});
