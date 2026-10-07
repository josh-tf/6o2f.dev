import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore plain JS module
import { beautify, minify, parse, stats, gzipSize } from '../../../public/_/css/lib.js';

test('url(data:...;base64,...) and strings with ; { } and escaped quotes stay whole', () => {
  const src = `.a{background:url(data:image/png;base64,iVBORw0KGgo=);content:"x;y{z}\\"q\\"";b:url( "a;b.png" )}`;
  assert.equal(minify(src).css, `.a{background:url(data:image/png;base64,iVBORw0KGgo=);content:"x;y{z}\\"q\\"";b:url("a;b.png")}`);
  assert.equal(beautify(src).css, `.a {\n  background: url(data:image/png;base64,iVBORw0KGgo=);\n  content: "x;y{z}\\"q\\"";\n  b: url("a;b.png");\n}\n`);
  assert.equal(minify(`a{content:'it\\'s'}`).css, `a{content:'it\\'s'}`);
});

test('at-rules nest: @media, @supports, @layer, statements', () => {
  const src = '@import url(x.css) screen;@media (min-width:600px){@supports (display:grid){.g{display:grid}}}@layer base,ui;';
  assert.equal(minify(src).css, '@import url(x.css) screen;@media (min-width:600px){@supports (display:grid){.g{display:grid}}}@layer base,ui;');
  assert.equal(
    beautify(src).css,
    '@import url(x.css) screen;\n\n@media (min-width:600px) {\n  @supports (display:grid) {\n    .g {\n      display: grid;\n    }\n  }\n}\n\n@layer base, ui;\n',
  );
});

test('custom properties keep odd values verbatim', () => {
  const src = ':root{--empty:;--obj:{ a: b; c: d };--j:[1,  2];--s: "}"  ;--i:1 !important}';
  const [rule] = parse(src);
  assert.deepEqual(
    rule.children.map((d: any) => [d.prop, d.value, d.important]),
    [
      ['--empty', '', false],
      ['--obj', '{ a: b; c: d }', false],
      ['--j', '[1,  2]', false],
      ['--s', '"}"', false],
      ['--i', '1', true],
    ],
  );
  assert.equal(minify(src).css, ':root{--empty:;--obj:{ a: b; c: d };--j:[1,  2];--s:"}";--i:1!important}');
});

test('CSS nesting', () => {
  assert.equal(
    beautify('.card{padding:1rem;&:hover{color:red}.t &{x:y}}').css,
    '.card {\n  padding: 1rem;\n\n  &:hover {\n    color: red;\n  }\n\n  .t & {\n    x: y;\n  }\n}\n',
  );
  assert.equal(minify('.card { a : b ; & > .x , &+.y { c : d } }').css, '.card{a:b;&>.x,&+.y{c:d}}');
});

test('comments: kept, removed, licence kept on minify', () => {
  const src = '/*! MIT */\n/* head */\na{color:red/* inline */;b:c}';
  assert.equal(beautify(src).css, '/*! MIT */\n/* head */\na {\n  color: red /* inline */;\n  b: c;\n}\n');
  assert.equal(beautify(src, { comments: false }).css, 'a {\n  color: red;\n  b: c;\n}\n');
  assert.equal(minify(src).css, '/*! MIT */a{color:red;b:c}');
  assert.equal(minify(src, { comments: true }).css, '/*! MIT *//* head */a{color:red;b:c}');
});

test('minify keeps meaningful spaces and handles last semicolon option', () => {
  assert.equal(
    minify('a  b > c ,d{margin:0  auto ;width:calc( 100% - 2px ) ;font:12px/1.5 a , b}').css,
    'a b>c,d{margin:0 auto;width:calc(100% - 2px);font:12px/1.5 a,b}',
  );
  assert.equal(minify('a{x:y}', { lastSemicolon: true }).css, 'a{x:y;}');
  assert.equal(minify('.w-1\\/2{width:50%}').css, '.w-1\\/2{width:50%}');
});

test('sorting: alphabetical, prefixes before standard, custom props first, shorthand warning', () => {
  const r = beautify('a{transition:x;-webkit-transition:x;padding-top:1px;padding:0;--z:1;color:red}', { sort: true });
  assert.equal(r.css, 'a {\n  --z: 1;\n  color: red;\n  padding: 0;\n  padding-top: 1px;\n  -webkit-transition: x;\n  transition: x;\n}\n');
  assert.equal(r.warnings.length, 1);
});

test('errors carry a location', () => {
  assert.throws(() => parse('a{color:red'), /never closed/);
  assert.throws(() => parse('a{content:"x}'), /Unterminated string \(line 1, column 11\)/);
  assert.throws(() => parse('}'), /Unexpected "}"/);
  assert.throws(() => parse('a{color red}'), /Expected "property: value"/);
  assert.throws(() => parse('/* x'), /Unterminated comment/);
});

test('stats and gzip size', async () => {
  assert.deepEqual(stats('@media x{a{b:c;d:e}}f{g:h}'), { rules: 2, decls: 3, at: 1 });
  assert.ok((await gzipSize('a{b:c}'.repeat(100))) < 100);
});

test('review fix: ~ + > inside attribute selectors are not combinators', () => {
  assert.match(beautify('a[class~=x]>b{c:d}').css, /^a\[class~=x\] > b \{/);
  assert.equal(minify('a[class ~= "x"] + b{c:d}').css, 'a[class~= "x"]+b{c:d}');
});
