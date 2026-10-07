import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { escape, unescape, LANGS, shellWord, decodeEntities } from '../../../public/_/escape/lib.js';

const SAMPLE = 'He said "it\'s 5\\6"\n\ttab é 😀 \u0001';
const un = (l: string, s: string) => unescape(l, s).text;

test('every language round-trips a tricky string', () => {
  for (const [lang] of LANGS) {
    for (const ascii of [false, true]) {
      const e = escape(lang, SAMPLE, { ascii });
      const back = lang === 'shsingle' || lang === 'shdouble' ? un(lang, e) : un(lang, e);
      assert.equal(back, SAMPLE, `${lang} ascii=${ascii}: ${e}`);
    }
  }
});

test('json', () => {
  assert.equal(escape('json', 'a"b\\\n'), 'a\\"b\\\\\\n');
  assert.equal(escape('json', '😀', { ascii: true }), '\\uD83D\\uDE00');
  assert.equal(escape('json', '\u2028'), '\\u2028');
  assert.equal(un('json', '\\uD83D\\uDE00'), '😀');
  assert.equal(un('json', '"quoted\\tvalue"'), 'quoted\tvalue');
  assert.throws(() => un('json', 'bad \\q'), /JSON/);
  assert.throws(() => un('json', 'x\\u12'), /JSON/);
});

test('javascript', () => {
  assert.equal(escape('js', "it's"), "it\\'s");
  assert.equal(escape('js', '😀', { ascii: true }), '\\u{1F600}');
  assert.equal(escape('js', '\0'), '\\x00');
  assert.equal(un('js', '\\u{1F600}\\x41\\u0042\\uD83D\\uDE00'), '😀AB😀');
  assert.equal(un('js', '\\101\\0'), 'A\0');
  assert.equal(un('js', 'a\\\nb'), 'ab');
  assert.equal(un('js', '\\q'), 'q');
  assert.throws(() => un('js', '\\u{110000}'), /10FFFF/);
  assert.throws(() => un('js', '\\xZZ'), /hex digits/);
  assert.throws(() => un('js', 'end\\'), /lone backslash/);
});

test('python', () => {
  assert.equal(escape('python', 'é😀', { ascii: true }), '\\xe9\\U0001f600');
  assert.throws(() => un('python', '\\N{BULLET}'), /named/);
  assert.equal(un('python', '\\q\\101\\x41\\u00e9\\U0001F600\\a'), '\\qAAé😀\x07');
});

test('c', () => {
  assert.equal(escape('c', 'é', { ascii: true }), '\\303\\251');
  assert.equal(escape('c', '\u0001A'), '\\001A');
  assert.equal(un('c', '\\303\\251'), 'é');
  assert.equal(un('c', '\\xe2\\x82\\xac'), '€');
  assert.equal(un('c', '\\u20AC\\e'), '€\x1b');
  assert.throws(() => un('c', '\\x41BC'), /out of range/);
  assert.throws(() => un('c', '\\q'), /not a C escape/);
});

test('java', () => {
  assert.equal(escape('java', '😀', { ascii: true }), '\\uD83D\\uDE00');
  assert.equal(un('java', '\\uuu0041\\s\\60'), 'A 0');
  assert.throws(() => un('java', '\\x41'), /not a Java/);
});

test('sql', () => {
  assert.equal(escape('sql', "O'Brien"), "O''Brien");
  assert.equal(un('sql', "'O''Brien'"), "O'Brien");
  assert.throws(() => un('sql', "O'Brien"), /doubled/);
});

test('shell', () => {
  assert.equal(escape('shsingle', "it's"), `'it'\\''s'`);
  assert.equal(escape('shdouble', 'a "$HOME" `x` \\'), '"a \\"\\$HOME\\" \\`x\\` \\\\"');
  assert.equal(shellWord(`"a\\nb"`).text, 'a\\nb'); // \n stays literal inside double quotes
  assert.equal(shellWord(`$'a\\tb'`).text, 'a\tb');
  assert.equal(shellWord(`plain\\ word`).text, 'plain word');
  assert.match(shellWord(`"$HOME"`).warnings[0], /expanded/);
  assert.throws(() => shellWord(`'open`), /Unclosed/);
});

test('regex', () => {
  assert.equal(escape('regex', 'a.b*c(1)/[x]'), 'a\\.b\\*c\\(1\\)\\/\\[x\\]');
  assert.equal(new RegExp(escape('regex', '1+1=2?')).test('1+1=2?'), true);
  assert.equal(un('regex', '/a\\.b\\//g'), 'a.b/');
  assert.throws(() => un('regex', '\\d+'), /character class/);
});

test('csv', () => {
  assert.equal(escape('csv', 'plain'), 'plain');
  assert.equal(escape('csv', 'a,b'), '"a,b"');
  assert.equal(escape('csv', 'say "hi"'), '"say ""hi"""');
  assert.equal(un('csv', '"line\nbreak"'), 'line\nbreak');
  assert.throws(() => un('csv', '"open'), /not closed/);
  assert.throws(() => un('csv', '"a"b'), /after the closing/);
});

test('html', () => {
  assert.equal(escape('html', `<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  assert.equal(decodeEntities('&copy; &#169; &#xA9; &#128; &nbsp &bogus;').text, '© © © € \u00a0 &bogus;');
  assert.equal(decodeEntities('&bogus;').warnings.length, 1);
});

test('url', () => {
  assert.equal(escape('url', "a b&c=d/é!'()*"), 'a%20b%26c%3Dd%2F%C3%A9%21%27%28%29%2A');
  assert.equal(un('url', 'a+b%20c'), 'a b c');
  assert.throws(() => un('url', '100%'), /two hex digits/);
  assert.throws(() => un('url', '%E9'), /UTF-8/);
  assert.throws(() => escape('url', '\uD800'), /surrogate/);
});

test('review fixes: regex escape works with the u flag; unclosed \\u{ in regex unescape errors instead of hanging', () => {
  const s = 'a-b[c-d]';
  assert.ok(new RegExp('^' + escape('regex', s) + '$', 'u').test(s));
  assert.ok(new RegExp('^[' + escape('regex', '-]') + ']+$', 'u').test('-]-'));
  assert.throws(() => unescape('regex', '\\u{41'), /closing }/);
});
