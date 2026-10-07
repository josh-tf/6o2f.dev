import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { OPS, runPipeline, toLines, unbackslash, rng } from '../../../public/_/lines/lib.js';

const run = (op: string, lines: string[], p = {}) => OPS[op].run(lines, { ...OPS[op].defaults, ...p });

test('toLines', () => {
  assert.deepEqual(toLines(''), []);
  assert.deepEqual(toLines('a\r\nb\rc\n'), ['a', 'b', 'c']);
  assert.deepEqual(toLines('a\n\n'), ['a', '']);
});

test('sort modes', () => {
  const l = ['file10', 'File2', 'file1', 'apple'];
  assert.deepEqual(run('sort', l, { by: 'natural' }), ['apple', 'file1', 'File2', 'file10']);
  assert.deepEqual(run('sort', l, { by: 'alpha' }), ['apple', 'file1', 'file10', 'File2']);
  assert.deepEqual(run('sort', l, { by: 'natural', desc: true }), ['file10', 'File2', 'file1', 'apple']);
  assert.deepEqual(run('sort', ['10 kg', 'x', '-2', '1,500', '3.5'], { by: 'numeric' }), ['-2', '3.5', '10 kg', '1,500', 'x']);
  assert.deepEqual(run('sort', ['10', 'x', '2'], { by: 'numeric', desc: true }), ['10', '2', 'x']);
  assert.deepEqual(run('sort', ['ccc', 'a', 'bb', '😀'], { by: 'length' }), ['😀', 'a', 'bb', 'ccc']);
});

test('shuffle and sample are reproducible with a seed and keep every line', () => {
  const l = Array.from({ length: 50 }, (_, i) => String(i));
  const a = run('shuffle', l, { seed: 'x' }),
    b = run('shuffle', l, { seed: 'x' });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, l);
  assert.deepEqual([...a].sort(), [...l].sort());
  const s = run('sample', l, { n: 5, seed: 7 });
  assert.equal(s.length, 5);
  assert.deepEqual(s, run('sample', l, { n: 5, seed: 7 }));
  assert.deepEqual(
    s,
    [...s].sort((x: string, y: string) => +x - +y),
  ); // original order kept
  assert.equal(run('sample', l, { n: 500 }).length, 50);
  assert.equal(typeof rng('')(), 'number');
});

test('dedupe', () => {
  const l = ['a', 'B', 'a', 'b', ' a'];
  assert.deepEqual(run('dedupe', l), ['a', 'B', 'b', ' a']);
  assert.deepEqual(run('dedupe', l, { ci: true }), ['a', 'B', ' a']);
  assert.deepEqual(run('dedupe', l, { ci: true, trim: true, counts: true }), ['3 a', '2 B']);
});

test('trim, empty, affix, number', () => {
  assert.deepEqual(run('trim', ['  a  ']), ['a']);
  assert.deepEqual(run('trim', ['  a  '], { side: 'start' }), ['a  ']);
  assert.deepEqual(run('noempty', ['a', '', '  ', 'b']), ['a', 'b']);
  assert.deepEqual(run('noempty', ['a', '', '  '], { blank: false }), ['a', '  ']);
  assert.deepEqual(run('affix', ['x'], { prefix: '"', suffix: '",' }), ['"x",']);
  assert.deepEqual(run('affix', ['x'], { prefix: '\\t', suffix: '' }), ['\tx']);
  const n = run('number', Array(10).fill('x'), { start: 1, sep: ': ', pad: true });
  assert.equal(n[0], '01: x');
  assert.equal(n[9], '10: x');
  assert.deepEqual(run('number', ['a', 'b'], { start: 0 }), ['0. a', '1. b']);
});

test('join and split', () => {
  assert.deepEqual(run('join', ['a', 'b', 'c'], { delim: ', ' }), ['a, b, c']);
  assert.deepEqual(run('join', ['a', 'b'], { delim: '\\t' }), ['a\tb']);
  assert.deepEqual(run('split', ['a, b,c', 'd']), ['a', 'b', 'c', 'd']);
  assert.deepEqual(run('split', ['a1b22c'], { delim: '\\d+', regex: true }), ['a', 'b', 'c']);
  assert.throws(() => run('split', ['a'], { delim: '' }), /delimiter/);
  assert.throws(() => run('split', ['a'], { delim: 'x*', regex: true }), /empty/);
  assert.equal(unbackslash('a\\nb\\\\'), 'a\nb\\');
});

test('filter', () => {
  const l = ['GET /a 200', 'POST /b 500', 'get /c 404'];
  assert.deepEqual(run('filter', l, { query: 'get' }), ['GET /a 200', 'get /c 404']);
  assert.deepEqual(run('filter', l, { query: 'get', ci: false }), ['get /c 404']);
  assert.deepEqual(run('filter', l, { query: ' [45]\\d\\d$', regex: true }), ['POST /b 500', 'get /c 404']);
  assert.deepEqual(run('filter', l, { query: '500', invert: true }), ['GET /a 200', 'get /c 404']);
  assert.throws(() => run('filter', l, { query: '(', regex: true }), /Invalid regular expression/);
});

test('head, reverse', () => {
  assert.deepEqual(run('head', ['a', 'b', 'c'], { n: 2 }), ['a', 'b']);
  assert.deepEqual(run('head', ['a', 'b', 'c'], { n: 2, from: 'end' }), ['b', 'c']);
  assert.deepEqual(run('head', ['a'], { n: 0, from: 'end' }), []);
  assert.deepEqual(run('reverse', ['a', 'b']), ['b', 'a']);
});

test('pipeline runs in order, reports counts and the failing step', () => {
  const r = runPipeline(['b', 'a', 'b', ''], [{ op: 'noempty' }, { op: 'dedupe' }, { op: 'sort', p: { by: 'alpha' } }, { op: 'reverse', off: true }]);
  assert.deepEqual(r.lines, ['a', 'b']);
  assert.deepEqual(r.counts, [3, 2, 2, 2]);
  assert.equal(r.error, null);
  const bad = runPipeline(['a'], [{ op: 'trim' }, { op: 'filter', p: { query: '[', regex: true } }]);
  assert.equal(bad.error.step, 1);
});

test('100k lines stay fast', () => {
  const l = Array.from({ length: 100000 }, (_, i) => `item ${(i * 7919) % 100000} ${i % 3 ? 'x' : 'y'}`);
  const t = performance.now();
  const r = runPipeline(l, [
    { op: 'trim' },
    { op: 'filter', p: { query: 'y', invert: true } },
    { op: 'sort', p: { by: 'natural' } },
    { op: 'dedupe' },
    { op: 'number' },
  ]);
  assert.equal(r.lines.length, 66666);
  assert.ok(performance.now() - t < 1500, `took ${performance.now() - t}ms`);
});

test('review fixes: counts on 300k unique lines, empty start number', () => {
  const big = Array.from({ length: 300000 }, (_, i) => 'l' + i);
  assert.equal(OPS.dedupe.run(big, { counts: true }).length, 300000);
  assert.deepEqual(OPS.number.run(['a', 'b'], { start: '', sep: '. ' }), ['1. a', '2. b']);
});
