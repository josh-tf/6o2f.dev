import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore plain JS module
import { parse, format, minify, toJson, fromJson, parserErrorInfo, offsetOf } from '../../../public/_/xml/lib.js';

const BOOKS = `<?xml version="1.0"?>
<!-- catalogue -->
<catalog xmlns:dc="http://purl.org/dc/elements/1.1/">
  <book id="bk101" lang='en'>
    <dc:title>XML &amp; You</dc:title>
    <price currency="AUD">44.95</price>
    <tag>xml</tag><tag>guide</tag>
    <summary><![CDATA[Uses <tags> & stuff]]></summary>
    <empty></empty>
  </book>
</catalog>`;

test('XML to JSON: attributes, text, repeated elements, namespaces, entities, CDATA', () => {
  assert.deepEqual(toJson(BOOKS), {
    catalog: {
      '@xmlns:dc': 'http://purl.org/dc/elements/1.1/',
      book: {
        '@id': 'bk101',
        '@lang': 'en',
        'dc:title': 'XML & You',
        price: { '@currency': 'AUD', '#text': '44.95' },
        tag: ['xml', 'guide'],
        summary: 'Uses <tags> & stuff',
        empty: '',
      },
    },
  });
  assert.deepEqual(toJson('<a><b><![CDATA[x]]></b><!-- hi --></a>', { cdata: 'key', comments: true }), { a: { b: { '#cdata': 'x' }, '#comment': 'hi' } });
  assert.deepEqual(toJson('<a>one<b/>two</a>'), { a: { b: '', '#text': 'onetwo' } });
});

test('JSON to XML: inverse mapping, escaping, arrays, CDATA, comments, bad names', () => {
  const { xml, warnings } = fromJson({
    catalog: { '@xmlns:dc': 'u', book: [{ '@id': 'a"1', 'dc:title': 'X & <Y>' }, { '@id': 'b' }], note: null, n: 3, ok: true, '#comment': 'a -- b' },
  });
  assert.equal(
    xml,
    '<?xml version="1.0" encoding="UTF-8"?>\n<catalog xmlns:dc="u">\n  <!-- a - - b -->\n  <book id="a&quot;1">\n    <dc:title>X &amp; &lt;Y&gt;</dc:title>\n  </book>\n  <book id="b"/>\n  <note/>\n  <n>3</n>\n  <ok>true</ok>\n</catalog>',
  );
  assert.deepEqual(warnings, []);
  assert.equal(fromJson({ a: { '#cdata': 'x]]>y' } }, { declaration: false }).xml, '<a><![CDATA[x]]]]><![CDATA[>y]]></a>');
  const r = fromJson({ 'first name': 'Ann', '2x': 1 }, { declaration: false });
  assert.equal(r.xml, '<root>\n  <first_name>Ann</first_name>\n  <_2x>1</_2x>\n</root>');
  assert.equal(r.warnings.length, 3);
  assert.equal(fromJson([1, 2], { declaration: false }).xml, '<root>\n  <item>1</item>\n  <item>2</item>\n</root>');
});

test('round trip XML -> JSON -> XML -> JSON is stable', () => {
  const j = toJson(BOOKS);
  assert.deepEqual(toJson(fromJson(j).xml), j);
});

test('format and minify', () => {
  assert.equal(
    format('<a><b x="1">t</b><c/><!--n--><d>  </d><p>Hi <i>there</i> you</p></a>'),
    '<a>\n  <b x="1">t</b>\n  <c/>\n  <!--n-->\n  <d/>\n  <p>Hi <i>there</i> you</p>\n</a>',
  );
  assert.equal(format('<a><b>1</b><!--n--></a>', { indent: '\t', comments: false }), '<a>\n\t<b>1</b>\n</a>');
  assert.equal(format('<a xml:space="preserve"> <b> x </b> </a>'), '<a xml:space="preserve"> <b> x </b> </a>');
  assert.equal(minify('<?xml version="1.0"?>\n<a>\n  <b> x </b>\n  <!-- c -->\n  <c></c>\n</a>'), '<?xml version="1.0"?><a><b> x </b><c/></a>');
  assert.equal(minify('<a> <!-- c --> </a>', { comments: true }), '<a><!-- c --></a>');
});

test('parse errors carry a location', () => {
  assert.throws(() => parse('<a>\n  <b></c>\n</a>'), /does not match <b> \(line 2, column 6\)/);
  assert.throws(() => parse('<a x=1/>'), /must be quoted/);
  assert.throws(() => parse('<a>&</a>'), /Unescaped "&"/);
  assert.throws(() => parse('<a/><b/>'), /Only one root/);
  assert.throws(() => parse('<a><b></a>'), /does not match <b>/);
  assert.throws(() => parse('<a>'), /<a> is never closed \(line 1, column 1\)/);
  assert.doesNotThrow(() => parse('<!DOCTYPE note [<!ENTITY x "y">]><note>&x;</note>'));
});

test('DOMParser error text is read for Chrome and Firefox', () => {
  assert.deepEqual(
    parserErrorInfo(
      'This page contains the following errors:error on line 3 at column 5: Opening and ending tag mismatch: b line 2 and aBelow is a rendering of the page up to the first error.',
    ),
    { line: 3, col: 5, message: 'Opening and ending tag mismatch: b line 2 and a' },
  );
  assert.deepEqual(parserErrorInfo('XML Parsing Error: mismatched tag. Expected: </b>.\nLocation: about:blank\nLine Number 3, Column 3:'), {
    line: 3,
    col: 3,
    message: 'mismatched tag. Expected: </b>.',
  });
  assert.equal(offsetOf('ab\ncd\nef', 3, 2), 7);
});

test('review fixes: Unicode and xml-prefixed names are valid, bad char refs do not throw', () => {
  const r = fromJson({ root: { 名前: 'x', xmlData: 1, 'a b': 2 } }, { declaration: false });
  assert.match(r.xml, /<名前>x<\/名前>/);
  assert.match(r.xml, /<xmlData>1<\/xmlData>/);
  assert.deepEqual(r.warnings, ['"a b" is not a valid XML name; written as "a_b"']);
  assert.doesNotThrow(() => parse('<a>&#xFFFFFFF;</a>'));
});
