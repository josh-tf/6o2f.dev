import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
// @ts-ignore browser module
import { convert } from '../../../public/_/yaml/lib.js';
const ctx: any = { exports: {}, module: {} }; // the vendored UMD build, loaded as the page does
vm.runInNewContext(fs.readFileSync(new URL('../../../public/_/yaml/vendor/js-yaml.min.js', import.meta.url), 'utf8'), ctx);
const yaml = ctx.exports;

test('yaml to json', () => {
  assert.equal(convert('a: 1\nb: [x, y]\n', 'y2j', yaml).text, '{\n  "a": 1,\n  "b": [\n    "x",\n    "y"\n  ]\n}');
  const m = convert('a: 1\n---\nb: 2\n', 'y2j', yaml);
  assert.equal(m.docs, 2);
  assert.deepEqual(JSON.parse(m.text), [{ a: 1 }, { b: 2 }]);
  assert.equal(convert('# only a comment\n', 'y2j', yaml).text, 'null');
  assert.equal(convert('a: 1', 'y2j', yaml, { indent: 4 }).text, '{\n    "a": 1\n}');
});
test('json to yaml', () => {
  assert.equal(convert('{"b":1,"a":[true,null]}', 'j2y', yaml).text, 'b: 1\na:\n  - true\n  - null\n');
  assert.equal(convert('{"b":1,"a":2}', 'j2y', yaml, { sortKeys: true }).text, 'a: 2\nb: 1\n');
});
test('errors carry positions', () => {
  assert.throws(
    () => convert('a: [1, 2\nb: 3', 'y2j', yaml),
    (e: any) => e.line > 0 && e.col > 0,
  );
  assert.throws(
    () => convert('a:\n  b: 1\n c: 2', 'y2j', yaml),
    (e: any) => e.line === 3,
  );
  assert.throws(
    () => convert('{"a": 1,}', 'j2y', yaml),
    (e: any) => e.line === 1,
  );
});
