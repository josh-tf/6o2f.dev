import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkUrl, safeFetch } from './net.ts';

test('checkUrl allows public hostnames', () => {
  assert.equal(checkUrl('https://example.com/a?b=1').hostname, 'example.com');
});
test('checkUrl refuses internal targets', () => {
  for (const u of [
    'http://localhost/',
    'http://127.0.0.1/',
    'http://10.0.0.1/',
    'http://192.168.1.1/',
    'http://169.254.169.254/',
    'http://[::1]/',
    'https://intranet/',
    'ftp://example.com/',
    'https://user:pw@example.com/',
    'https://example.com:22/',
    'http://foo.internal/',
    'http://2130706433/',
    'https://node.example.ts.net:8443/',
    'http://1.0.0.127.in-addr.arpa/',
    'http://redis.default.svc/',
  ])
    assert.throws(() => checkUrl(u), u);
});

test('safeFetch drops credentials on a cross-origin redirect, keeps them same-origin', async () => {
  const seen: (string | null)[] = [];
  const orig = globalThis.fetch;
  const hops = ['https://a.example.com/2', 'https://b.example.com/3', null];
  globalThis.fetch = (async (_u: URL, init: RequestInit) => {
    seen.push(new Headers(init.headers).get('authorization'));
    const loc = hops.shift();
    return loc ? new Response(null, { status: 302, headers: { location: loc } }) : new Response('ok');
  }) as typeof fetch;
  try {
    await safeFetch('https://a.example.com/1', { headers: { authorization: 'Bearer x' } });
  } finally {
    globalThis.fetch = orig;
  }
  assert.deepEqual(seen, ['Bearer x', 'Bearer x', null]);
});
