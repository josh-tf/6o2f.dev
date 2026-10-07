import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sameOrigin } from './auth.ts';

test('CSRF: only the request origin itself is trusted, not sibling tool hosts', () => {
  const url = 'https://admin.6o2f.dev/api/users';
  assert.ok(sameOrigin('https://admin.6o2f.dev', url, undefined));
  for (const o of ['https://send.6o2f.dev', 'https://6o2f.dev', 'https://anything.6o2f.dev', 'http://admin.6o2f.dev', 'https://evil.com', 'null'])
    assert.ok(!sameOrigin(o, url, 'same-origin'), o);
  assert.ok(sameOrigin(undefined, url, 'same-origin'));
  assert.ok(!sameOrigin(undefined, url, 'same-site'));
  assert.ok(!sameOrigin(undefined, url, undefined));
});
