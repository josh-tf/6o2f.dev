import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crawlerFamily, DECOY, holdFor, ipKey, isTrap, maze, MAZE, mazeCost, mazeDoc, mazeFormat, mazeHtml, mazePage } from './guard.ts';

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
  const a = await (await maze(`${MAZE}seed`, 'html', 'x.6o2f.dev', 0)).text(),
    b = await (await maze(`${MAZE}seed`, 'html', 'x.6o2f.dev', 0)).text();
  assert.equal(a, b);
  assert.equal((a.match(new RegExp(`href="${MAZE}[0-9a-f]{8}"`, 'g')) ?? []).length, 8);
  assert.match(a, /noindex/);
  // the admin Maze tab rebuilds who went where from mazePage's links, so they must be the links actually served
  assert.deepEqual(
    [...a.matchAll(new RegExp(`href="${MAZE}([0-9a-f]{8})"`, 'g'))].map((m) => m[1]),
    mazePage(`${MAZE}seed`).links.map((l) => l.id),
  );
});

test('every page type carries the 8 links mazePage reports, and costs add up', () => {
  const types = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const path = `${MAZE}${i.toString(16).padStart(8, '0')}`,
      html = mazeHtml(path);
    types.add(html.includes('Index of') ? 'index' : html.includes('Showing records') ? 'records' : 'report');
    const hrefs = [...html.matchAll(new RegExp(`href="${MAZE}([0-9a-f]{8})"`, 'g'))].map((m) => m[1]);
    assert.deepEqual(
      hrefs,
      mazePage(path).links.map((l) => l.id),
      path,
    );
    assert.ok(!/href="(?!\/__maze\/)/.test(html), `${path}: every link stays in the maze`);
    const c = mazeCost(path, 'html', 'x.6o2f.dev');
    assert.equal(c.bytes, new TextEncoder().encode(html).length);
    assert.ok(c.words > 20, path);
  }
  assert.deepEqual([...types].sort(), ['index', 'records', 'report']);
});

test('format by path and Accept', () => {
  assert.equal(mazeFormat('/.env', 'text/html'), 'text');
  assert.equal(mazeFormat('/.env.local', '*/*'), 'text');
  assert.equal(mazeFormat('/.git/config', ''), 'text');
  assert.equal(mazeFormat('/.git/HEAD', ''), 'html'); // other honeypots: HTML whatever they asked for
  assert.equal(mazeFormat('/wp-login.php', 'application/json'), 'html');
  assert.equal(mazeFormat(`${MAZE}abc`, 'text/html,application/xhtml+xml'), 'html');
  assert.equal(mazeFormat(`${MAZE}abc`, 'application/json'), 'json');
  assert.equal(mazeFormat('/', '*/*'), 'json');
  assert.equal(mazeFormat('/', ''), 'json');
  assert.equal(mazeFormat('/', 'image/avif,image/webp'), null);
});

test('JSON and bait files carry the same 8 maze links', () => {
  const host = 'paste.6o2f.dev';
  for (const path of [`${MAZE}0badcafe`, '/.env', '/.git/config']) {
    const want = mazePage(path).links.map((l) => l.id);
    for (const fmt of ['json', 'text'] as const) {
      const doc = mazeDoc(path, fmt, host),
        got = [...doc.matchAll(/https:\/\/paste\.6o2f\.dev\/__maze\/([0-9a-f]{8})/g)].map((m) => m[1]);
      assert.deepEqual(got.sort(), [...want].sort(), `${fmt} ${path}`);
      if (fmt === 'json') assert.equal(JSON.parse(doc).data.length, 7);
      assert.equal(mazeDoc(path, fmt, host), doc, 'deterministic');
    }
  }
  assert.match(mazeDoc('/.env', 'text', host), /^# Decoy: .*\nAPP_NAME=.*\nAPP_ENV=production/);
  assert.match(mazeDoc('/.git/config', 'text', host), /^# Decoy: .*\n\[core\]\n\trepositoryformatversion = 0\n/);
});

test('holdFor stretches the delay for a bot that keeps coming, up to 4x', () => {
  const path = `${MAZE}feed`,
    base = mazePage(path).delay,
    first = holdFor('198.51.100.1', path);
  let last = first;
  for (let i = 0; i < 400; i++) last = holdFor('198.51.100.1', path);
  assert.ok(first < base * 1.05);
  assert.equal(last, Math.round(base * 4));
  assert.ok(holdFor('198.51.100.2', path) < base * 1.05, 'per IP');
});

test('crawler families', () => {
  assert.deepEqual(crawlerFamily('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)'), {
    name: 'GPTBot',
    type: 'AI',
  });
  assert.deepEqual(
    crawlerFamily(
      'Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)',
    ),
    { name: 'Bytespider', type: 'AI' },
  );
  assert.deepEqual(crawlerFamily('python-requests/2.32.3'), { name: 'python', type: 'Script' });
  assert.deepEqual(crawlerFamily('curl/8.5.0'), { name: 'curl', type: 'Script' });
  assert.deepEqual(crawlerFamily(''), { name: '(no user agent)', type: 'Script' });
  assert.deepEqual(crawlerFamily('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0'), { name: 'Browser-like', type: 'Other' });
  assert.deepEqual(crawlerFamily('Fuzzer9000/1.0'), { name: 'Fuzzer9000', type: 'Other' });
});

test('every document tells a human it is a decoy', () => {
  for (const path of [`${MAZE}0badcafe`, `${MAZE}00000001`, `${MAZE}00000002`, '/.env', '/.git/config'])
    for (const fmt of ['html', 'json', 'text'] as const) assert.ok(mazeDoc(path, fmt, 'x.6o2f.dev').includes(DECOY), `${fmt} ${path}`);
  assert.equal(JSON.parse(mazeDoc(`${MAZE}0badcafe`, 'json', 'x.6o2f.dev'))._notice, DECOY);
});
