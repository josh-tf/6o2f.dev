import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore no types for the browser module
import { encode, decode, parse, build } from '../../../public/_/url/lib.js';

test('encode modes', () => {
  assert.equal(encode('a b&c=d/é', false), 'a%20b%26c%3Dd%2F%C3%A9');
  assert.equal(encode('https://x.dev/a b?q=é', true), 'https://x.dev/a%20b?q=%C3%A9');
});
test('decode and errors', () => {
  assert.equal(decode('a%20b%C3%A9', false, false), 'a bé');
  assert.equal(decode('a+b', false, true), 'a b');
  assert.equal(decode('a+b', false, false), 'a+b');
  assert.equal(decode('a%2Fb', true, false), 'a%2Fb'); // decodeURI keeps reserved escapes
  assert.throws(() => decode('100%', false, false), /Malformed percent sequence "%" at position 4/);
  assert.throws(() => decode('a%zzb', false, false), /"%zz" at position 2/);
  assert.throws(() => decode('%E0%A4%A', false, false), /Malformed/);
  assert.throws(() => decode('%C3', false, false), /UTF-8/);
});
test('parse and build', () => {
  const p = parse('https://u:pw@Example.com:8080/a%20b/c?x=1&x=2&q=a+b%20c&flag#top');
  assert.equal(p.host, 'example.com');
  assert.equal(p.port, '8080');
  assert.equal(p.hash, '#top');
  assert.equal(p.path, '/a%20b/c');
  assert.deepEqual(p.rows, [
    ['x', '1'],
    ['x', '2'],
    ['q', 'a b c'],
    ['flag', ''],
  ]);
  assert.equal(build(p, false), 'https://u:pw@example.com:8080/a%20b/c?x=1&x=2&q=a%20b%20c&flag=#top');
  assert.equal(build(p, true), 'https://u:pw@example.com:8080/a%20b/c?x=1&x=2&q=a+b+c&flag=#top');
  p.rows = [];
  p.hash = '';
  assert.equal(build(p, false), 'https://u:pw@example.com:8080/a%20b/c');
  assert.equal(build(parse('mailto:a@b.co?subject=hi'), false), 'mailto:a@b.co?subject=hi');
  assert.throws(() => parse('not a url'));
});
