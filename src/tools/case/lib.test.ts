import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore no types for the browser module
import { words, CASES, convert } from '../../../public/_/case/lib.js';

const f = (k: string) => CASES.find((c: any[]) => c[0] === k)[2];
test('word splitting', () => {
  assert.deepEqual(words('HTTPServer'), ['HTTP', 'Server']);
  assert.deepEqual(words('parseXML2Json'), ['parse', 'XML', '2', 'Json']);
  assert.deepEqual(words('some-snake_case.and  spaces/path'), ['some', 'snake', 'case', 'and', 'spaces', 'path']);
  assert.deepEqual(words('version2beta'), ['version', '2', 'beta']);
  assert.deepEqual(words("don't Stop"), ['dont', 'Stop']);
  assert.deepEqual(words('ÉcoleNormale über'), ['École', 'Normale', 'über']);
  assert.deepEqual(words('  --  '), []);
});
test('all cases', () => {
  const s = 'HTTPServer error: the QUICK brown fox';
  assert.equal(f('snake')('HTTPServer'), 'http_server');
  assert.equal(f('constant')('helloWorld 2'), 'HELLO_WORLD_2');
  assert.equal(f('camel')(s), 'httpServerErrorTheQuickBrownFox');
  assert.equal(f('pascal')('make it-so'), 'MakeItSo');
  assert.equal(f('kebab')('Hello World'), 'hello-world');
  assert.equal(f('dot')('Hello World'), 'hello.world');
  assert.equal(f('path')('Hello World'), 'hello/world');
  assert.equal(f('title')("the QUICK fox's den"), "The Quick Fox's Den");
  assert.equal(f('sentence')('hELLO there. how ARE you? fine!  ok'), 'Hello there. How are you? Fine!  Ok');
  assert.equal(f('alt')('Hello, world'), 'hElLo, WoRlD');
  assert.equal(f('upper')('straße'), 'STRASSE');
});
test('per line', () => assert.equal(convert(f('snake'), 'fooBar\r\nBaz Qux\n\nX'), 'foo_bar\nbaz_qux\n\nx'));
