import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { CODES, CATEGORIES, search, byCode } from '../../../public/_/httpcodes/codes.js';

// IANA HTTP Status Code Registry, every assigned value 100-599 (checked 2026).
const IANA = [
  100, 101, 102, 103, 200, 201, 202, 203, 204, 205, 206, 207, 208, 226, 300, 301, 302, 303, 304, 305, 306, 307, 308, 400, 401, 402, 403, 404, 405, 406, 407,
  408, 409, 410, 411, 412, 413, 414, 415, 416, 417, 418, 421, 422, 423, 424, 425, 426, 428, 429, 431, 451, 500, 501, 502, 503, 504, 505, 506, 507, 508, 510,
  511,
];

test('every registered code is present exactly once, nothing extra', () => {
  const codes = CODES.map((c: any) => c.code);
  assert.equal(new Set(codes).size, codes.length, 'duplicates');
  assert.deepEqual(
    [...codes].sort((a, b) => a - b),
    IANA,
  );
  assert.deepEqual(
    codes,
    [...codes].sort((a: number, b: number) => a - b),
    'sorted',
  );
});
test('every entry is complete', () => {
  for (const c of CODES) {
    for (const k of ['name', 'spec', 'meaning', 'use', 'mistakes']) assert.ok(c[k] && c[k].length >= 2, `${c.code}.${k}`);
    assert.ok(Array.isArray(c.headers));
    assert.ok(['yes', 'maybe', 'no'].includes(c.retry), `${c.code}.retry`);
    assert.ok(CATEGORIES[Math.floor(c.code / 100)]);
  }
  // RFC 9110 15.1 heuristically cacheable set
  assert.deepEqual(
    CODES.filter((c: any) => c.cache).map((c: any) => c.code),
    [200, 203, 204, 206, 300, 301, 308, 404, 405, 410, 414, 451, 501],
  );
});
test('search', () => {
  assert.deepEqual(
    search('404').map((c: any) => c.code),
    [404],
  );
  assert.deepEqual(
    search('41').map((c: any) => c.code),
    [410, 411, 412, 413, 414, 415, 416, 417, 418],
  );
  assert.equal(search('').length, IANA.length);
  assert.ok(search('', 5).every((c: any) => c.code >= 500));
  assert.ok(search('rate limit').some((c: any) => c.code === 429));
  assert.ok(search('Retry-After').some((c: any) => c.code === 503));
  assert.deepEqual(
    search('teapot').map((c: any) => c.code),
    [418],
  );
  assert.equal(search('zzzz').length, 0);
  assert.equal(search('404', 2).length, 0);
  assert.equal(byCode('201').name, 'Created');
  assert.equal(byCode(999), undefined);
});
