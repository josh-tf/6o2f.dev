import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDays, pathKey, uaInfo } from './stats.ts';

test('uaInfo classifies browsers, devices, bots and clients', () => {
  assert.deepEqual(uaInfo('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0'), {
    browser: 'Edge',
    device: 'desktop',
    bot: false,
  });
  assert.equal(
    uaInfo('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1').device,
    'mobile',
  );
  assert.equal(uaInfo('Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0').browser, 'Firefox');
  assert.equal(uaInfo('curl/8.4.0').browser, 'cli');
  assert.equal(uaInfo('Googlebot/2.1').bot, true);
  assert.equal(uaInfo('').browser, 'cli');
});
test('pathKey keeps cardinality low', () => {
  assert.equal(pathKey('/'), '/');
  assert.equal(pathKey('/api/clips/8208704318900-5bd7bc'), '/api/clips/:id');
  assert.equal(pathKey('/api/kv/mykey'), '/api/kv/mykey');
  assert.equal(pathKey('/api/monitors/12/checks'), '/api/monitors/:n/checks');
  assert.equal(pathKey('/abc'), '/:x'); // short link slugs collapse
  assert.equal(pathKey('/wp-login.php'), '/:x');
  assert.equal(pathKey('/h/Ab12Cd34Ef/foo/bar'), '/h/:id/foo/bar');
  // error responses keep only the first known segment: junk paths share one row
  assert.equal(pathKey('/api/qv1x/zz9q', true), '/api/:x');
  assert.equal(pathKey('/api/zzqqxxw', true), '/api/:x');
  assert.equal(pathKey('/wp-login.php', true), '/:x');
  assert.equal(pathKey('/', true), '/');
});
test('addDays crosses month and year', () => {
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
});
