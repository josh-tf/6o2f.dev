// @ts-nocheck node:test has no types in this project (no @types/node)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTarget, randomSlug, SLUG } from './logic.ts';

test('checkTarget', () => {
  assert.deepEqual(checkTarget('https://example.com/a', '6o2f.dev'), { url: 'https://example.com/a' });
  for (const bad of [
    'javascript:alert(1)',
    'data:text/html,x',
    'ftp://x.com',
    'nope',
    'https://6o2f.dev/x',
    'https://s.6o2f.dev',
    'https://' + 'a'.repeat(2050) + '.com',
    5,
  ])
    assert.ok('error' in checkTarget(bad, '6o2f.dev'), String(bad));
  assert.ok('url' in checkTarget('https://not6o2f.dev', '6o2f.dev'));
});
test('slugs', () => {
  assert.match(randomSlug(), SLUG);
  assert.ok(!SLUG.test('ab') && !SLUG.test('a b c') && SLUG.test('a_b-9'));
});
