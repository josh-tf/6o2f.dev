import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import {
  CODE_RE,
  ID_RE,
  chunkRanges,
  chunkSize,
  cleanOffer,
  fmtBytes,
  fmtEta,
  fmtSpeed,
  friendlyName,
  genCode,
  guessDevice,
  parseCode,
  rate,
  sanitizeFileName,
  sanitizeName,
  uniqueName,
} from '../../../public/_/send/lib.js';

test('codes: generated codes are valid, alphabet is 32 symbols, parseCode normalises', () => {
  for (let i = 0; i < 500; i++) assert.match(genCode(), CODE_RE);
  assert.equal(
    genCode(() => Uint8Array.from([0, 1, 31, 32, 255, 8])),
    'AB9A9J',
  );
  assert.equal(parseCode('#abc-234'), 'ABC234');
  assert.equal(parseCode(' hjk mnp '), 'HJKMNP');
  for (const bad of ['', 'ABC23', 'ABC2345', 'ABCI23', 'ABCO23', 'ABC201', null, undefined]) assert.equal(parseCode(bad), null);
});
test('names', () => {
  assert.match(
    friendlyName(() => 0),
    /^Quick Fox$/,
  );
  assert.equal(sanitizeName('  Al\u0007ice\n' + 'x'.repeat(50)).length, 32);
  assert.equal(sanitizeName(undefined), '');
  assert.equal(guessDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', true, 390), 'phone');
  assert.equal(guessDevice('Mozilla/5.0 (Linux; Android 14; Pixel Tablet)', true, 800), 'tablet');
  assert.equal(guessDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile', true, 412), 'phone');
  assert.equal(guessDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X)', true, 820), 'tablet');
  assert.equal(guessDevice('Mozilla/5.0 (X11; Linux x86_64)', false, 1920), 'desktop');
  assert.equal(guessDevice('Mozilla/5.0 (Windows NT 10.0)', false, 1366), 'laptop');
  assert.equal(guessDevice('', false, 1000), 'other');
});
test('file names are sanitised', () => {
  assert.equal(sanitizeFileName('../../etc/passwd'), 'etcpasswd');
  assert.equal(sanitizeFileName('C:\\dir\\a:b?.txt'), 'C_dira_b_.txt');
  assert.equal(sanitizeFileName('a\u0000b\u001f.txt'), 'ab.txt');
  assert.equal(sanitizeFileName('...'), 'file');
  assert.equal(sanitizeFileName(''), 'file');
  assert.equal(sanitizeFileName(null), 'file');
  assert.equal(sanitizeFileName('.bashrc'), 'bashrc');
  const long = sanitizeFileName('a'.repeat(300) + '.jpeg');
  assert.equal(long.length, 120);
  assert.ok(long.endsWith('.jpeg'));
  assert.equal(sanitizeFileName('x'.repeat(300)).length, 120);
});
test('uniqueName and cleanOffer', () => {
  const t = new Set();
  assert.deepEqual(
    ['a.txt', 'A.txt', 'a.txt', 'noext', 'noext'].map((n) => uniqueName(n, t)),
    ['a.txt', 'A (2).txt', 'a (3).txt', 'noext', 'noext (2)'],
  );
  const o = cleanOffer([
    { id: '0', name: '../x.txt', size: 5 },
    { id: '1', name: 'x.txt', size: 6 },
    { id: '2', name: 'bad', size: -1 },
    { id: '3', name: 'bad', size: 1.5 },
    { id: 4, name: 'n', size: 1 },
    null,
  ]);
  assert.deepEqual(o, [
    { id: '0', name: 'x.txt', size: 5 },
    { id: '1', name: 'x (2).txt', size: 6 },
  ]);
  assert.equal(cleanOffer(Array.from({ length: 80 }, (_, i) => ({ id: String(i), name: 'f' + i, size: 1 }))).length, 50);
  assert.deepEqual(cleanOffer('nope'), []);
});
test('chunk planning', () => {
  assert.equal(chunkSize(262144), 65536);
  assert.equal(chunkSize(30000), 30000);
  for (const bad of [undefined, 0, NaN, Infinity, -1]) assert.equal(chunkSize(bad), 16384);
  assert.deepEqual(
    [...chunkRanges(10, 4)],
    [
      [0, 4],
      [4, 8],
      [8, 10],
    ],
  );
  assert.deepEqual([...chunkRanges(0, 4)], []);
  const r = [...chunkRanges(5_000_001, 65536)];
  assert.equal(r.length, Math.ceil(5_000_001 / 65536));
  assert.equal(r.at(-1)[1], 5_000_001);
});
test('formatting and ETA', () => {
  assert.equal(fmtBytes(0), '0 B');
  assert.equal(fmtBytes(1023), '1023 B');
  assert.equal(fmtBytes(1024), '1 KB');
  assert.equal(fmtBytes(14.2 * 1024 * 1024), '14.2 MB');
  assert.equal(fmtBytes(100 * 1024 * 1024), '100 MB');
  assert.equal(fmtBytes(1.5 * 2 ** 30), '1.5 GB');
  assert.equal(fmtSpeed(2048), '2 KB/s');
  assert.equal(fmtEta(Infinity), '--');
  assert.equal(fmtEta(0.2), '1s');
  assert.equal(fmtEta(75), '1m 15s');
  assert.equal(fmtEta(7300), '2h 2m');
  assert.deepEqual(rate(500, 1000, 1000), { speed: 500, eta: 1 });
  assert.equal(rate(0, 1000, 0).eta, Infinity);
});

test('ids from a peer: only short alphanumerics (they land in HTML attributes)', () => {
  for (const ok of ['0', 'a1b2c3d4', 'Z'.repeat(16)]) assert.ok(ID_RE.test(ok));
  for (const bad of ['', 'x'.repeat(17), '"><img onerror=', 'x/+alert() src=', 'a b', 'a"']) assert.ok(!ID_RE.test(bad));
  assert.deepEqual(
    cleanOffer([
      { id: '"><img onerror=', name: 'a', size: 1 },
      { id: 'ok1', name: 'b', size: 1 },
    ]).map((f) => f.id),
    ['ok1'],
  );
});
