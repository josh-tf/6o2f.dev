import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { parse, stringify, bytes, lossy } from '../../../public/_/json/lib.js';

test('error line/column', () => {
  const r = parse('{\n  "a": 1,\n  "b": }');
  assert.equal(r.error === undefined, false);
  assert.deepEqual([r.line, r.col], [3, 8]);
  const e = parse('{"a":');
  assert.equal(e.line, 1);
});
test('format, minify, sort', () => {
  const v = parse('{"b":1,"a":{"d":1,"c":[2,{"z":1,"y":2}]}}').value;
  assert.equal(stringify(v, 0, true), '{"a":{"c":[2,{"y":2,"z":1}],"d":1},"b":1}');
  assert.equal(stringify(v, '\t', false).split('\n')[1], '\t"b": 1,');
  assert.equal(bytes('é'), 2);
});
test('locate cases', () => {
  for (const [t, l, c] of [
    ['[1,]', 1, 4],
    ['{"a" 1}', 1, 6],
    ['{"a":"x\n"}', 1, 8],
    ['[1] x', 1, 5],
    ['tru', 1, 1],
    ['', 1, 1],
  ] as const) {
    const r = parse(t);
    assert.deepEqual([r.line, r.col], [l, c], t);
  }
});
test('lossy numbers are counted, strings and exact numbers are not', () => {
  assert.equal(lossy('[12345678901234567890, 9007199254740993, 1.5, 0.1, 1e3, -0.0, 0.30000000000000004]'), 2);
  assert.equal(lossy('{"id":"12345678901234567890","n":9007199254740991}'), 0);
});
test('error offset', () => assert.equal(parse('{"a":1,}').at, 7));
