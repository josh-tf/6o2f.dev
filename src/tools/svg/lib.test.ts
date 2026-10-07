import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { parseXml, sanitize, optimize, serialize, process, roundNum, dataUri, base64Uri, cssBg, attr } from '../../../public/_/svg/lib.js';

const ALL = { comments: true, metadata: true, editor: true, defaults: true, round: 2, whitespace: true };
const NONE = { comments: false, metadata: false, editor: false, defaults: false, round: -1, whitespace: false };
const clean = (s: string) => process(parseXml(s), NONE).svg;

test('script elements are removed, wherever they are', () => {
  const out = clean(
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><g><script type="text/ecmascript"><![CDATA[alert(2)]]></script><circle r="5"/></g></svg>',
  );
  assert.doesNotMatch(out, /script|alert/i);
  assert.match(out, /<circle r="5"\/>/);
});
test('on* handlers (any case) are removed', () => {
  const out = clean(
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect ONCLICK="x()" onmouseover="y()" width="5"/><animate onbegin="z()"/></svg>',
  );
  assert.doesNotMatch(out, /on\w+=|alert|x\(\)|y\(\)|z\(\)/i);
  assert.match(out, /width="5"/);
});
test('javascript:, data: and external hrefs are removed, including entity-encoded and whitespace-split ones', () => {
  const out = clean(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <a href="javascript:alert(1)"><text>a</text></a><a xlink:href=" JaVaScRiPt:alert(2)"><text>b</text></a>
    <a href="&#106;avascript:alert(3)"><text>c</text></a><a href="java&#x09;script:alert(4)"><text>d</text></a>
    <image href="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="/><use href="https://evil.example/x.svg#a"/><use href="#ok"/>
    <rect id="ok" style="fill:url(https://evil.example/t.png);stroke:red" fill="url(#grad)"/></svg>`);
  assert.doesNotMatch(out, /javascript|alert|data:|evil/i);
  assert.match(out, /<use href="#ok"\/>/);
  assert.match(out, /fill="url\(#grad\)"/);
  assert.match(out, /style="fill:none;stroke:red"/);
});
test('foreignObject (and HTML inside it), iframes and embeds are removed', () => {
  const out = clean(
    '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject width="100" height="100"><div xmlns="http://www.w3.org/1999/xhtml"><img src="x" onerror="alert(1)"/></div></foreignObject><iframe src="https://x"/><embed src="x"/><circle r="1"/></svg>',
  );
  assert.doesNotMatch(out, /foreignObject|iframe|embed|img|alert/i);
  assert.match(out, /circle/);
});
test('SMIL that rewrites href to javascript: is removed; ordinary animation stays', () => {
  const out = clean(
    '<svg xmlns="http://www.w3.org/2000/svg"><a><set attributeName="href" to="javascript:alert(1)"/><animate attributeName="xlink:href" values="javascript:alert(2)"/><text>x</text></a><circle r="2"><animate attributeName="r" values="2;4;2" dur="1s"/></circle></svg>',
  );
  assert.doesNotMatch(out, /javascript|<set/);
  assert.match(out, /attributeName="r"/);
});
test('style elements lose @import and external url()', () => {
  const out = clean(
    '<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(https://evil.example/a.css); .a{fill:url(https://evil.example/x)} .b{fill:url(#g)}</style></svg>',
  );
  assert.doesNotMatch(out, /evil|@import/);
  assert.match(out, /url\(#g\)/);
});
test('the report lists what was removed', () => {
  const r = sanitize(parseXml('<svg><script/><script/><rect onclick="a"/></svg>'));
  assert.deepEqual(r, [
    { what: '<script> element', count: 2 },
    { what: 'on* event attribute', count: 1 },
  ]);
});
test('DOCTYPE entity tricks are dropped and the root must be svg', () => {
  const out = clean(
    '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x "<script>alert(1)</script>">]><svg xmlns="http://www.w3.org/2000/svg"><text>&x;</text></svg>',
  );
  assert.doesNotMatch(out, /<script|ENTITY/);
  assert.throws(() => sanitize(parseXml('<html><body/></html>')), /not <svg>/);
  assert.throws(() => parseXml('<svg><g></svg>'), /does not match/);
  assert.throws(() => parseXml('<svg>'), /never closed/);
  assert.throws(() => parseXml('hello'), /No SVG/);
});
test('optimise: comments, metadata, editor namespaces, defaults, rounding, whitespace', () => {
  const src = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generator: Some Editor -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" viewBox="0 0 24.000001 24" inkscape:version="1.2">
  <metadata><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/></metadata>
  <sodipodi:namedview id="nv" />
  <g fill-opacity="1" stroke="red">
    <path d="M 1.23456 2.5 L 10.0001 -3.99999 Z" stroke-width="1" fill-opacity="1"/>
    <rect x="0" y="0" width="10.50" height="5" inkscape:label="box"/>
  </g>
  <text> Hello   world </text>
</svg>`;
  const out = serialize(optimize(sanitizeAnd(src), ALL));
  assert.equal(
    out,
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g stroke="red"><path d="M1.23 2.5L10-4Z"/><rect width="10.5" height="5"/></g><text> Hello world </text></svg>',
  );
});
function sanitizeAnd(s: string) {
  const t = parseXml(s);
  sanitize(t);
  return t;
}
test('an inherited default that overrides an ancestor is kept', () => {
  const out = serialize(optimize(parseXml('<svg><g stroke-width="3"><path stroke-width="1" d="M0 0"/></g><path stroke-width="1" d="M0 0"/></svg>'), ALL));
  assert.equal(out, '<svg><g stroke-width="3"><path stroke-width="1" d="M0 0"/></g><path d="M0 0"/></svg>');
});
test('round numbers', () => {
  assert.equal(roundNum('M0.123456 -0.0000001 1e-7 12.5000', 3), 'M.123 0 0 12.5');
  assert.equal(roundNum('10.555 -0.75', 1), '10.6 -.8');
});
test('data URI, base64, CSS', () => {
  const s = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0" fill="#f00"/></svg>';
  assert.equal(dataUri(s), "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0' fill='%23f00'/%3E%3C/svg%3E");
  assert.equal(Buffer.from(base64Uri(s).split(',')[1], 'base64').toString(), s);
  assert.match(cssBg(s), /^background-image: url\("data:image\/svg\+xml,%3Csvg/);
  assert.match(base64Uri('<svg><text>é ✓</text></svg>'), /^data:image\/svg\+xml;base64,/);
});
test('process sets dimensions and adds xmlns', () => {
  const t = parseXml('<svg width="10"><rect/></svg>');
  const { svg } = process(t, NONE, { viewBox: '0 0 10 10', width: '', height: '20' });
  assert.equal(svg, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" height="20"><rect/></svg>');
  assert.equal(attr(t, 'width'), undefined);
});
test('apostrophes in values survive the data URI', () => {
  const src = `<svg xmlns="http://www.w3.org/2000/svg"><text font-family="'Open Sans'">it's</text></svg>`,
    u = dataUri(src);
  assert.doesNotMatch(u, /"/);
  assert.equal(decodeURIComponent(u.slice(19)), src);
});
test('packed arc flags are not merged by rounding', () => {
  assert.equal(roundNum('a5 5 0 01 2.3456 3', 2), 'a5 5 0 01 2.35 3');
  assert.equal(roundNum('a5 5 0 0010.5 3', 2), 'a5 5 0 0010.5 3');
});
test('links under any prefix and prefixed SMIL targets are removed', () => {
  const out = clean(
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:x="http://www.w3.org/1999/xlink"><image x:href="https://evil.example/a.png"/><a><set attributeName="x:href" to="https://evil.example"/></a></svg>',
  );
  assert.doesNotMatch(out, /evil|<set/);
});
