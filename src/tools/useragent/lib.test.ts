import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { parse, summary, SAMPLES } from '../../../public/_/useragent/lib.js';

// [ua, browser, major, engine, os, osVersion, deviceType, vendor, bot]
const CASES: [string, string, string, string, string, string, string, string, string][] = [
  [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Chrome',
    '124',
    'Blink',
    'Windows',
    '10 or 11',
    'desktop',
    '',
    '',
  ],
  [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.2478.80',
    'Edge',
    '124',
    'Blink',
    'Windows',
    '10 or 11',
    'desktop',
    '',
    '',
  ],
  ['Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0', 'Firefox', '125', 'Gecko', 'Windows', '10 or 11', 'desktop', '', ''],
  [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
    'Safari',
    '17',
    'WebKit',
    'macOS',
    '10.15.7',
    'desktop',
    'Apple',
    '',
  ],
  [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Chrome',
    '124',
    'Blink',
    'macOS',
    '10.15.7',
    'desktop',
    'Apple',
    '',
  ],
  ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:125.0) Gecko/20100101 Firefox/125.0', 'Firefox', '125', 'Gecko', 'macOS', '14.4', 'desktop', 'Apple', ''],
  [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
    'Safari',
    '17',
    'WebKit',
    'iOS',
    '17.4.1',
    'mobile',
    'Apple',
    '',
  ],
  [
    'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    'Safari',
    '16',
    'WebKit',
    'iPadOS',
    '16.6',
    'tablet',
    'Apple',
    '',
  ],
  [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.88 Mobile/15E148 Safari/604.1',
    'Chrome for iOS',
    '124',
    'WebKit',
    'iOS',
    '17.4',
    'mobile',
    'Apple',
    '',
  ],
  [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/125.0 Mobile/15E148 Safari/605.1.15',
    'Firefox for iOS',
    '125',
    'WebKit',
    'iOS',
    '17.4',
    'mobile',
    'Apple',
    '',
  ],
  [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/124.0.2478.71 Mobile/15E148 Safari/605.1.15',
    'Edge',
    '124',
    'WebKit',
    'iOS',
    '17.4',
    'mobile',
    'Apple',
    '',
  ],
  [
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    'Chrome',
    '124',
    'Blink',
    'Android',
    '10',
    'mobile',
    '',
    '',
  ],
  [
    'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36',
    'Samsung Internet',
    '24',
    'Blink',
    'Android',
    '13',
    'mobile',
    'Samsung',
    '',
  ],
  [
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
    'Chrome',
    '116',
    'Blink',
    'Android',
    '13',
    'mobile',
    'Google',
    '',
  ],
  ['Mozilla/5.0 (Android 14; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0', 'Firefox', '125', 'Gecko', 'Android', '14', 'mobile', '', ''],
  [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 OPR/109.0.0.0',
    'Opera',
    '109',
    'Blink',
    'Windows',
    '10 or 11',
    'desktop',
    '',
    '',
  ],
  [
    'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Chrome',
    '124',
    'Blink',
    'Android',
    '13',
    'tablet',
    'Samsung',
    '',
  ],
  [
    'Mozilla/5.0 (Linux; Android 12; SM-G991B Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.163 Mobile Safari/537.36',
    'Chrome WebView',
    '119',
    'Blink',
    'Android',
    '12',
    'mobile',
    'Samsung',
    '',
  ],
  [
    'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Chrome',
    '124',
    'Blink',
    'ChromeOS',
    '14541.0.0',
    'desktop',
    '',
    '',
  ],
  ['Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0', 'Firefox', '125', 'Gecko', 'Linux', '', 'desktop', '', ''],
  ['Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko', 'Internet Explorer', '11', 'Trident', 'Windows', '7', 'desktop', '', ''],
  [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36 Edge/18.19582',
    'Edge',
    '18',
    'EdgeHTML',
    'Windows',
    '10 or 11',
    'desktop',
    '',
    '',
  ],
  [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 YaBrowser/24.4.0.0 Safari/537.36',
    'Yandex Browser',
    '24',
    'Blink',
    'Windows',
    '10 or 11',
    'desktop',
    '',
    '',
  ],
  [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.291 Electron/28.2.3 Safari/537.36',
    'Electron',
    '28',
    'Blink',
    'Windows',
    '10 or 11',
    'desktop',
    '',
    '',
  ],
  [
    'Mozilla/5.0 (PlayStation; PlayStation 5/2.26) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0 Safari/605.1.15',
    'Safari',
    '13',
    'WebKit',
    'PlayStation',
    '2.26',
    'console',
    'Sony',
    '',
  ],
  [
    'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/538.1 (KHTML, like Gecko) Version/6.0 TV Safari/538.1',
    'Smart TV browser',
    '',
    'WebKit',
    'Tizen',
    '6.0',
    'tv',
    'Samsung',
    '',
  ],
  ['Opera/9.80 (Android; Opera Mini/36.2.2254/119.132; U; id) Presto/2.12.423 Version/12.16', 'Opera Mini', '36', 'Presto', 'Android', '', 'mobile', '', ''],
  [
    'Mozilla/5.0 (Linux; Android 12; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
    'Chrome',
    '112',
    'Blink',
    'Android',
    '12',
    'mobile',
    'Xiaomi',
    '',
  ],
  // bots and clients
  ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', '', '', '', '', '', 'bot', '', 'Googlebot'],
  [
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.118 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Chrome',
    '124',
    'Blink',
    'Android',
    '6.0.1',
    'bot',
    '',
    'Googlebot',
  ],
  ['Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', '', '', '', '', '', 'bot', '', 'Bingbot'],
  ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)', '', '', 'WebKit', '', '', 'bot', '', 'GPTBot'],
  ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)', '', '', 'WebKit', '', '', 'bot', '', 'ClaudeBot'],
  [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)',
    'Safari',
    '13',
    'WebKit',
    'macOS',
    '10.15.5',
    'bot',
    '',
    'Applebot',
  ],
  ['facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', '', '', '', '', '', 'bot', '', 'facebookexternalhit'],
  ['Twitterbot/1.0', '', '', '', '', '', 'bot', '', 'Twitterbot'],
  ['Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)', '', '', '', '', '', 'bot', '', 'Slackbot'],
  ['DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)', '', '', '', '', '', 'bot', '', 'DuckDuckBot'],
  [
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/124.0.6367.29 Safari/537.36',
    'Headless Chrome',
    '124',
    'Blink',
    'Linux',
    '',
    'desktop',
    '',
    'HeadlessChrome',
  ],
  ['curl/8.5.0', '', '', '', '', '', 'client', '', 'curl'],
  ['Wget/1.21.4', '', '', '', '', '', 'client', '', 'Wget'],
  ['python-requests/2.31.0', '', '', '', '', '', 'client', '', 'python-requests'],
  ['Go-http-client/2.0', '', '', '', '', '', 'client', '', 'Go-http-client'],
  ['okhttp/4.12.0', '', '', '', '', '', 'client', '', 'okhttp'],
  ['Mozilla/5.0 (compatible; SomeNewCrawler/0.3; +https://example.com/crawler)', '', '', '', '', '', 'bot', '', 'SomeNewCrawler'],
];

test('real user agents', () => {
  assert.ok(CASES.length >= 25);
  for (const [ua, br, major, eng, osn, osv, type, vendor, bot] of CASES) {
    const r = parse(ua);
    const got = [r.browser.name, r.browser.major ?? '', r.engine.name, r.os.name, r.os.version, r.device.type, r.device.vendor, r.bot?.name ?? ''];
    assert.deepEqual(got, [br, major, eng, osn, osv, type, vendor, bot], ua);
  }
});
test('details', () => {
  const s = parse('Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36');
  assert.equal(s.device.model, 'SM-S918B');
  assert.equal(parse('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36').device.model, '');
  assert.equal(
    parse(
      'Mozilla/5.0 (Linux; Android 12; SM-G991B Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.163 Mobile Safari/537.36',
    ).device.model,
    'SM-G991B',
  );
  assert.equal(
    parse('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36').device.model,
    'Pixel 7',
  );
  assert.equal(parse('Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0').os.distro, 'Ubuntu');
  assert.equal(parse('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)').bot.kind, 'search');
  assert.equal(parse('curl/8.5.0').bot.kind, 'client');
  assert.equal(parse('curl/8.5.0').bot.version, '8.5.0');
  assert.equal(parse('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)').bot.kind, 'ai');
  assert.ok(
    parse('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36').notes.some((n: string) =>
      /reduced/.test(n),
    ),
  );
  assert.ok(
    parse(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.88 Mobile/15E148 Safari/604.1',
    ).notes.some((n: string) => /WebKit/.test(n)),
  );
  assert.equal(parse('').empty, true);
  assert.equal(parse('   ').empty, true);
  const junk = parse('hello world');
  assert.equal(junk.browser.name, '');
  assert.equal(junk.bot, null);
});
test('summary', () => {
  assert.equal(summary(parse(SAMPLES[0][1])), 'Chrome 124 on Windows 10 or 11 (desktop)');
  assert.equal(summary(parse('curl/8.5.0')), 'curl 8.5.0 (HTTP client)');
  assert.equal(summary(parse('Twitterbot/1.0')), 'Twitterbot 1.0 (social bot)');
  for (const [, ua] of SAMPLES) assert.ok(summary(parse(ua)).length > 4);
});

test('review fixes: frozen Gecko rv, models with parentheses, Xbox, compatible-token bot names', () => {
  assert.equal(parse('Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0').engine.version, '115.0');
  assert.equal(
    parse('Mozilla/5.0 (Linux; Android 11; moto g(30)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36').device.model,
    'moto g(30)',
  );
  assert.equal(
    parse('Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox One) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36 Edge/18.19041')
      .os.name,
    'Xbox OS',
  );
  assert.equal(parse('Mozilla/5.0 (compatible; Google-Safety; +http://www.google.com/bot.html)').bot?.name, 'Google-Safety');
});
