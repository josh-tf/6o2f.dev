import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { parseCSV, toCSV, detectDelimiter, rowsToJSON, jsonToRows } from '../../../public/_/csv/lib.js';

test('nasty quoting', () => {
  assert.deepEqual(parseCSV('a,"b,c","say ""hi""","line1\nline2"\r\n1,,"",x\r\n'), [
    ['a', 'b,c', 'say "hi"', 'line1\nline2'],
    ['1', '', '', 'x'],
  ]);
  assert.deepEqual(parseCSV('a,b'), [['a', 'b']]);
  assert.deepEqual(parseCSV('a,b\n\n'), [['a', 'b'], ['']]);
  assert.deepEqual(parseCSV(',\n'), [['', '']]);
  assert.deepEqual(parseCSV('﻿x\ry\r'), [['x'], ['y']]);
  assert.deepEqual(parseCSV(''), []);
  assert.deepEqual(parseCSV('"a""",b'), [['a"', 'b']]);
  assert.throws(() => parseCSV('a,"oops\n'), /line 1/);
  assert.throws(() => parseCSV('"a"x,b'), /closing quote/);
});
test('round trip', () => {
  const rows = [
    ['a,b', 'q"', 'n\nl', ' sp', ''],
    ['1', '2', '3', '4', '5'],
  ];
  assert.deepEqual(parseCSV(toCSV(rows)), rows);
  assert.equal(toCSV([['a;b', 'c']], ';'), '"a;b";c');
});
test('delimiter', () => {
  assert.equal(detectDelimiter('a;b;c\n1,2,3'), ';');
  assert.equal(detectDelimiter('"a,b,c"\tx\ty'), '\t');
  assert.equal(detectDelimiter('a|b\n'), '|');
  assert.equal(detectDelimiter('abc'), ',');
});
test('json mapping', () => {
  assert.deepEqual(
    rowsToJSON(
      [
        ['a', 'a', ''],
        ['1', 'true'],
      ],
      true,
      true,
    ),
    [{ a: 1, a_2: true }],
  );
  assert.deepEqual(rowsToJSON([['a'], ['1']], false, false), [['a'], ['1']]);
  assert.deepEqual(jsonToRows([{ a: 1, b: { x: 1 } }, { c: null }], true), [
    ['a', 'b', 'c'],
    ['1', '{"x":1}', ''],
    ['', '', ''],
  ]);
  assert.deepEqual(jsonToRows([[1, 'x']], true), [['1', 'x']]);
  assert.throws(() => jsonToRows([1, 2], true));
});
