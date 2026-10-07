import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { parse, parseCSV, detect, toMarkdown, toHTML, toASCII, toCSV, width, normalize } from '../../../public/_/table/lib.js';

test('csv: quotes, doubled quotes, multi-line cells, CRLF', () => {
  assert.deepEqual(parseCSV('a,b\r\n"x, y","say ""hi"""\n"multi\nline",3\n'), [
    ['a', 'b'],
    ['x, y', 'say "hi"'],
    ['multi\nline', '3'],
  ]);
  assert.throws(() => parseCSV('a,"open\n'), /never closed/);
  assert.deepEqual(parseCSV('a\tb\n1\t2', '\t'), [
    ['a', 'b'],
    ['1', '2'],
  ]);
});

test('format detection', () => {
  assert.equal(detect('[{"a":1}]'), 'json');
  assert.equal(detect('<table><tr><td>1</td></tr></table>'), 'html');
  assert.equal(detect('| a | b |\n|---|:-:|\n| 1 | 2 |'), 'markdown');
  assert.equal(detect('a\tb\n1\t2'), 'tsv');
  assert.equal(detect('a;b;c\n1,5;2;3'), 'ssv');
  assert.equal(detect('a,b'), 'csv');
});

test('ragged rows are padded', () => {
  const t = parse('a,b,c\n1\n1,2,3,4');
  assert.deepEqual(t.rows, [
    ['a', 'b', 'c', ''],
    ['1', '', '', ''],
    ['1', '2', '3', '4'],
  ]);
  assert.equal(t.aligns.length, 4);
  assert.equal(normalize([['a'], ['b', 'c']]).ragged, true);
});

test('markdown parse: alignment, escaped pipes, <br>', () => {
  const t = parse('| Name | Qty | Note |\n|:-----|----:|:----:|\n| a \\| b | 2 | x<br>y |\n| c |');
  assert.deepEqual(t.aligns, ['l', 'r', 'c']);
  assert.deepEqual(t.rows[1], ['a | b', '2', 'x\ny']);
  assert.deepEqual(t.rows[2], ['c', '', '']);
  assert.throws(() => parse('| a |\n| b |', 'markdown'), /separator/);
});

test('html parse', () => {
  const t = parse(
    '<table><thead><tr><th>Name</th><th style="text-align:right">Price</th></tr></thead><tbody><tr><td>Tea &amp; <b>cake</b></td><td>4.50</td></tr><tr><td colspan="2">line<br>two</td></tr></tbody></table>',
  );
  assert.deepEqual(t.rows, [
    ['Name', 'Price'],
    ['Tea & cake', '4.50'],
    ['line\ntwo', ''],
  ]);
  assert.deepEqual(t.aligns, ['', 'r']);
  assert.throws(() => parse('<table></table>', 'html'), /No <tr>/);
});

test('json parse', () => {
  const t = parse('[{"name":"a","n":1},{"name":"b","tags":["x"],"n":2.5}]');
  assert.deepEqual(t.rows, [
    ['name', 'n', 'tags'],
    ['a', '1', ''],
    ['b', '2.5', '["x"]'],
  ]);
  assert.deepEqual(t.aligns, ['', 'r', '']);
  assert.deepEqual(parse('[["h1","h2"],[1,null]]').rows, [
    ['h1', 'h2'],
    ['1', ''],
  ]);
  assert.deepEqual(parse('{"items":[{"a":1}]}').rows, [['a'], ['1']]);
  assert.throws(() => parse('[1,'), /Invalid JSON/);
  assert.throws(() => parse('[]'), /non-empty/);
});

test('markdown output is aligned and escapes pipes and newlines', () => {
  const md = toMarkdown({
    rows: [
      ['Name', 'Qty', 'Note'],
      ['apple', '10', 'a|b'],
      ['kiwi', '2', 'two\nlines'],
    ],
    aligns: ['l', 'r', 'c'],
  });
  assert.equal(
    md,
    ['| Name  | Qty |     Note     |', '| :---- | --: | :----------: |', '| apple |  10 |     a\\|b     |', '| kiwi  |   2 | two<br>lines |'].join('\n'),
  );
  assert.equal(toMarkdown({ rows: [['a'], ['b']], aligns: [''] }, { compact: true }), '| a |\n| --- |\n| b |');
  // round trip
  const back = parse(md);
  assert.deepEqual(back.rows[1], ['apple', '10', 'a|b']);
  assert.deepEqual(back.rows[2][2], 'two\nlines');
  assert.deepEqual(back.aligns, ['l', 'r', 'c']);
});

test('wide characters count as two columns', () => {
  assert.equal(width('日本'), 4);
  assert.equal(width('é'), 1);
  assert.equal(width('é'), 1);
  assert.equal(width('😀'), 2);
  const md = toMarkdown({ rows: [['x'], ['日本語']], aligns: [''] });
  assert.equal(md.split('\n')[0], '| x      |');
});

test('html output escapes and keeps alignment', () => {
  const html = toHTML({
    rows: [
      ['a<b', 'n'],
      ['x\ny', '1'],
    ],
    aligns: ['', 'r'],
  });
  assert.match(html, /<th>a&lt;b<\/th><th style="text-align: right">n<\/th>/);
  assert.match(html, /<td>x<br>y<\/td>/);
});

test('ascii box with multi-line cells', () => {
  assert.equal(
    toASCII({
      rows: [
        ['id', 'name'],
        ['1', 'two\nlines'],
      ],
      aligns: ['r', ''],
    }),
    ['┌────┬───────┐', '│ id │ name  │', '├────┼───────┤', '│  1 │ two   │', '│    │ lines │', '└────┴───────┘'].join('\n'),
  );
  assert.equal(toASCII({ rows: [['a']], aligns: [''] }, 'ascii'), '+---+\n| a |\n+---+');
});

test('csv output quotes when needed and round-trips', () => {
  const rows = [
    ['a', 'b,c'],
    ['say "x"', 'multi\nline'],
    [' pad', ''],
  ];
  const csv = toCSV({ rows });
  assert.equal(csv, 'a,"b,c"\r\n"say ""x""","multi\nline"\r\n" pad",');
  assert.deepEqual(parseCSV(csv), rows);
});
