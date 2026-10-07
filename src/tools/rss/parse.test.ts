import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decode, parseFeed } from './parse.ts';

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel>
<title>Example &amp; Co Blog</title><link>https://example.com/</link>
<item><title><![CDATA[Shipping <b>v2</b> & more]]></title><link>https://example.com/v2</link><pubDate>Tue, 06 Oct 2026 09:30:00 GMT</pubDate>
<description><![CDATA[<p>We &amp; the team <a href="/x">shipped</a> it.</p><script>alert(1)</script>]]></description></item>
<item><title>Escaped &lt;em&gt;html&lt;/em&gt; &amp;amp; things</title><link>https://example.com/esc</link><dc:date>2026-10-05T10:00:00Z</dc:date>
<description>&lt;p&gt;Fish &amp;amp; chips &amp;#8212; &amp;#x1F41F;&lt;/p&gt;</description></item>
<item><title>No date, bad link</title><link>javascript:alert(1)</link><guid isPermaLink="false">abc</guid><description>${'x'.repeat(300)}</description></item>
<item><title>Guid link only</title><guid>https://example.com/g</guid></item>
</channel></rss>`;

const ATOM = `<feed xmlns="http://www.w3.org/2005/Atom"><title type="html">Atom &lt;Feed&gt;</title><link href="https://a.example/" rel="self"/>
<entry><title>First</title><link rel="self" href="https://a.example/self"/><link rel="alternate" href="https://a.example/1?a=1&amp;b=2"/><updated>2026-10-01T00:00:00+10:00</updated><summary>Plain &amp; simple</summary></entry>
<entry><title>Second</title><link href="ftp://a.example/2"/><published>garbage</published><content type="html">&lt;div&gt;Body&lt;/div&gt;</content></entry></feed>`;

test('rss 2.0', () => {
  const f = parseFeed(RSS)!;
  assert.equal(f.title, 'Example & Co Blog');
  assert.equal(f.items.length, 4);
  assert.deepEqual(f.items[0], {
    title: 'Shipping v2 & more',
    link: 'https://example.com/v2',
    date: '2026-10-06T09:30:00.000Z',
    snippet: 'We & the team shipped it.',
  });
  assert.equal(f.items[1].title, 'Escaped <em>html</em> &amp; things');
  assert.equal(f.items[1].date, '2026-10-05T10:00:00.000Z');
  assert.equal(f.items[1].snippet, 'Fish & chips — 🐟');
});
test('missing dates, unsafe links, long snippets', () => {
  const [, , bad, guid] = parseFeed(RSS)!.items;
  assert.equal(bad.date, null);
  assert.equal(bad.link, null);
  assert.equal(bad.snippet.length, 200);
  assert.ok(bad.snippet.endsWith('…'));
  assert.equal(guid.link, 'https://example.com/g');
  assert.equal(guid.snippet, '');
});
test('atom', () => {
  const f = parseFeed(ATOM)!;
  assert.equal(f.title, 'Atom <Feed>');
  assert.equal(f.items[0].link, 'https://a.example/1?a=1&b=2');
  assert.equal(f.items[0].date, '2026-09-30T14:00:00.000Z');
  assert.equal(f.items[0].snippet, 'Plain & simple');
  assert.equal(f.items[1].link, null);
  assert.equal(f.items[1].date, null);
  assert.equal(f.items[1].snippet, 'Body');
});
test('not a feed / entities', () => {
  assert.equal(parseFeed('<html><body>hi</body></html>'), null);
  assert.equal(decode('&#0; &bogus; &lt;'), '&#0; &bogus; <');
  assert.equal(parseFeed('<rss><channel><title>T</title></channel></rss>')!.items.length, 0);
});
