import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore plain ES module shared with the browser
import {
  toMs,
  normalizeUrl,
  dupeKey,
  parseTags,
  makeBookmark,
  parseNetscape,
  parseJson,
  parseImport,
  mergeImport,
  findDupe,
  view,
  tagCounts,
  toNetscape,
  toJson,
  decodeEntities,
} from '../../../public/_/bookmarks/lib.js';

test('url validation: http and https only', () => {
  assert.equal(normalizeUrl('example.com/a'), 'https://example.com/a');
  assert.equal(normalizeUrl(' http://Example.com '), 'http://example.com/');
  assert.equal(normalizeUrl('example.com:8080/x'), 'https://example.com:8080/x'); // host:port is not a scheme
  assert.equal(normalizeUrl('localhost:3000'), 'https://localhost:3000/');
  assert.equal(normalizeUrl('javascript:1'), null);
  // ADD_DATE in seconds (browsers), milliseconds or microseconds -> ms
  assert.equal(toMs(1700000000), 1700000000000);
  assert.equal(toMs(1700000000000), 1700000000000);
  assert.equal(toMs(1700000000000000), 1700000000000);
  assert.equal(toMs(0), undefined);
  assert.equal(toMs(NaN), undefined);
  for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'ftp://x.org', 'file:///etc/passwd', '', 'not a url', 'https://', 'intranet'])
    assert.equal(normalizeUrl(bad), null, bad);
  assert.equal(typeof makeBookmark({ url: 'javascript:alert(1)' }), 'string');
  const b = makeBookmark({ url: 'https://developer.mozilla.org/', title: '', tags: 'Docs, web dev, docs' }, 5);
  assert.equal(b.title, 'developer.mozilla.org');
  assert.deepEqual(b.tags, ['docs', 'web-dev']);
  assert.equal(b.added, 5);
});

test('duplicate detection ignores scheme, www, trailing slash, fragment, host case', () => {
  const k = dupeKey('https://www.Example.com/path/?q=1#top');
  assert.equal(k, dupeKey('http://example.com/path?q=1'));
  assert.notEqual(k, dupeKey('https://example.com/path?q=2'));
  assert.notEqual(dupeKey('https://example.com/Path'), dupeKey('https://example.com/path'));
  const list = [makeBookmark({ url: 'https://example.com/a' })];
  assert.ok(findDupe(list, 'example.com/a/'));
  assert.equal(findDupe(list, 'example.com/a', list[0].id), undefined);
  assert.deepEqual(parseTags(['#A', 'a', ' b c ']), ['a', 'b-c']);
});

const CHROME = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1700000000" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
    <DL><p>
        <DT><A HREF="https://developer.mozilla.org/en-US/" ADD_DATE="1700000001" ICON="data:image/png;base64,AAA">MDN Web Docs</A>
        <DT><H3 ADD_DATE="1700000002">Dev &amp; Ops</H3>
        <DL><p>
            <DT><A HREF="https://developers.cloudflare.com/workers/" ADD_DATE="1700000003" TAGS="cloudflare,serverless">Workers &lt;docs&gt;</A>
            <DT><A HREF="javascript:void(0)">Bookmarklet</A>
        </DL><p>
        <DT><A HREF="https://news.ycombinator.com/" ADD_DATE="1700000004">Hacker News</A>
    </DL><p>
    <DT><A HREF='https://example.org/?a=1&amp;b=2'>Single &#39;quoted&#39; &#x1F600;</A>
</DL><p>`;

test('netscape import: folders become tags, entities decoded, dates in ms', () => {
  const items = parseNetscape(CHROME);
  assert.equal(items.length, 5);
  assert.deepEqual(items[0], { url: 'https://developer.mozilla.org/en-US/', title: 'MDN Web Docs', tags: [], added: 1700000001000 });
  assert.deepEqual(items[1].tags, ['Dev & Ops', 'cloudflare', 'serverless']);
  assert.equal(items[1].title, 'Workers <docs>');
  assert.deepEqual(items[3].tags, []); // back out of the sub-folder
  assert.equal(items[4].url, 'https://example.org/?a=1&b=2');
  assert.equal(items[4].title, "Single 'quoted' 😀");
  const r = mergeImport([], items, 1);
  assert.deepEqual([r.added, r.dupes, r.invalid], [4, 0, 1]); // the javascript: bookmarklet is rejected
  assert.deepEqual(r.list[1].tags, ['dev-&-ops', 'cloudflare', 'serverless']);
  assert.equal(decodeEntities('&bogus; &#65;'), '&bogus; A');
});

test('json import accepts our export, plain arrays and other shapes', () => {
  const list = [makeBookmark({ url: 'https://a.com', title: 'A', tags: ['x'], added: 1000 }), makeBookmark({ url: 'https://b.com', title: 'B' })];
  const back = parseImport(toJson(list));
  assert.deepEqual(
    back.map((b: { url: string; added: number }) => [b.url, b.added]),
    [
      ['https://a.com/', 1000],
      ['https://b.com/', list[1].added],
    ],
  );
  assert.equal(parseJson('[{"href":"https://c.com","description":"C","time":5}]')[0].title, 'C');
  assert.throws(() => parseJson('{"nope":1}'), /Expected a list/);
  assert.throws(() => parseJson('{bad'), /Not valid JSON/);
  assert.throws(() => parseImport('hello'), /Unrecognised/);
});

test('merge skips duplicates already saved and within the import', () => {
  const list = [makeBookmark({ url: 'https://a.com/x' })];
  const r = mergeImport(list, [{ url: 'http://www.a.com/x/' }, { url: 'https://b.com' }, { url: 'https://b.com/#frag' }, { url: 'nope' }]);
  assert.deepEqual([r.added, r.dupes, r.invalid, r.list.length], [1, 2, 1, 2]);
});

test('netscape export round-trips through the importer', () => {
  const list = [makeBookmark({ url: 'https://a.com/?x=1&y="2"', title: 'A <b> & "c"', tags: 'one,two', added: 1_700_000_000_000 })];
  const html = toNetscape(list);
  assert.match(html, /^<!DOCTYPE NETSCAPE-Bookmark-file-1>/);
  assert.ok(!html.includes('<b>'));
  const [b] = parseNetscape(html);
  assert.equal(b.url, 'https://a.com/?x=1&y=%222%22');
  assert.equal(b.title, 'A <b> & "c"');
  assert.deepEqual(b.tags, ['one', 'two']);
  assert.equal(b.added, 1_700_000_000_000);
});

test('search, tag filter, sort and counts', () => {
  const l = [
    makeBookmark({ url: 'https://zeta.io', title: 'Zeta docs', tags: 'docs', added: 3 }),
    makeBookmark({ url: 'https://alpha.dev', title: 'alpha tools', tags: 'tools,docs', added: 1 }),
    makeBookmark({ url: 'https://mid.org', title: 'Mid', tags: '', added: 2 }),
  ];
  assert.deepEqual(
    view(l).map((b: { title: string }) => b.title),
    ['Zeta docs', 'Mid', 'alpha tools'],
  );
  assert.deepEqual(
    view(l, { sort: 'title' }).map((b: { title: string }) => b.title),
    ['alpha tools', 'Mid', 'Zeta docs'],
  );
  assert.deepEqual(view(l, { tag: 'tools' }).length, 1);
  assert.deepEqual(view(l, { q: 'DOCS zeta' }).length, 1);
  assert.deepEqual(view(l, { q: 'alpha.dev' }).length, 1);
  assert.deepEqual(tagCounts(l), [
    ['docs', 2],
    ['tools', 1],
  ]);
});
