import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import {
  encodeText,
  decodeText,
  parseHex,
  parseBinary,
  parseDecimal,
  toHex,
  toPlain,
  toBinary,
  toDecimal,
  toCArray,
  toBase64,
  dumpRows,
  dumpText,
  search,
  inspect,
} from '../../../public/_/hex/lib.js';

const hello = Uint8Array.from([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x0a]);

test('encodings', () => {
  assert.equal(toHex(encodeText('é€', 'utf-8')), 'c3 a9 e2 82 ac');
  assert.equal(toHex(encodeText('A😀', 'utf-16le')), '41 00 3d d8 00 de');
  assert.equal(toHex(encodeText('A😀', 'utf-16be')), '00 41 d8 3d de 00');
  assert.equal(toHex(encodeText('é', 'latin1')), 'e9');
  assert.throws(() => encodeText('€', 'latin1'), /no Latin-1/);
  assert.equal(decodeText(Uint8Array.from([0x3d, 0xd8, 0x00, 0xde]), 'utf-16le').text, '😀');
  assert.equal(decodeText(Uint8Array.from([0xe9]), 'latin1').text, 'é');
  assert.equal(decodeText(Uint8Array.from([0x80]), 'latin1').text, '\u0080'); // true ISO-8859-1, not windows-1252
  const bad = decodeText(Uint8Array.from([0x41, 0xff]), 'utf-8');
  assert.equal(bad.text, 'A�');
  assert.equal(bad.bad, 1);
});

test('hex input in every common shape', () => {
  const want = toHex(hello);
  for (const src of [
    '48 65 6c 6c 6f 0a',
    '48656C6C6F0A',
    '0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x0a',
    '\\x48\\x65\\x6c\\x6c\\x6f\\x0a',
    'unsigned char data[6] = {\n  0x48, 0x65, 0x6c, 0x6c, 0x6f, 0xa // hi\n};',
    '00000000: 4865 6c6c 6f0a                           Hello.',
    '00000000  48 65 6c 6c 6f 0a                                 |Hello.|\n00000006',
    '48:65:6c:6c:6f:0a',
    '4865\n6c6c\n6f0a',
  ]) {
    assert.equal(toHex(parseHex(src)), want, src);
  }
  assert.equal(parseHex('').length, 0);
  assert.throws(() => parseHex('48 6'), /Odd number/);
  assert.throws(() => parseHex('48 zz'), /"z" is not a hex digit/);
  assert.throws(() => parseHex('0x123'), /more than one byte/);
});

test('xxd dump with ASCII that looks like hex', () => {
  assert.equal(toHex(parseHex('00000000: cafe babe                                cafe')), 'ca fe ba be');
  assert.equal(
    toHex(parseHex('00000000: 4865 6c6c 6f20 776f 726c 640a 4865 6c6c  Hello world.Hell\n00000010: 6f0a                                     o.')),
    toHex(encodeText('Hello world.Hello\n'.replace('.', '\n'))),
  );
});

test('binary and decimal input', () => {
  assert.deepEqual([...parseBinary('01001000 01101001')], [72, 105]);
  assert.deepEqual([...parseBinary('0100100001101001')], [72, 105]);
  assert.deepEqual([...parseBinary('1 10 11')], [1, 2, 3]);
  assert.throws(() => parseBinary('0100100'), /whole number of bytes/);
  assert.throws(() => parseBinary('0102'), /not binary/);
  assert.deepEqual([...parseDecimal('72, 105 [255]')], [72, 105, 255]);
  assert.throws(() => parseDecimal('256'), /0 to 255/);
});

test('outputs', () => {
  assert.equal(toHex(hello, '', true), '48656C6C6F0A');
  assert.equal(toPlain(new Uint8Array(31)), '0'.repeat(60) + '\n00');
  assert.equal(toBinary(Uint8Array.from([5])), '00000101');
  assert.equal(toDecimal(hello), '72 101 108 108 111 10');
  assert.equal(toCArray(hello, 'msg'), 'unsigned char msg[6] = {\n  0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x0a\n};');
  assert.equal(toCArray(new Uint8Array(13)).split('\n').length, 4);
  assert.equal(toBase64(hello), 'SGVsbG8K');
});

test('dump layout matches hexdump -C', () => {
  const b = encodeText('The quick brown fox jumps\x00\x01!');
  assert.equal(
    dumpText(b),
    [
      '00000000  54 68 65 20 71 75 69 63  6b 20 62 72 6f 77 6e 20  |The quick brown |',
      '00000010  66 6f 78 20 6a 75 6d 70  73 00 01 21              |fox jumps..!|',
      '0000001c',
    ].join('\n'),
  );
  assert.equal(dumpText(b, 8).split('\n')[0], '00000000  54 68 65 20 71 75 69 63  |The quic|');
  const rows = dumpRows(b, 16, 20, 30);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].offset, 16);
  assert.equal(rows[0].bytes.length, 12);
  assert.equal(dumpText(new Uint8Array(0)), '00000000');
});

test('search finds overlapping matches', () => {
  const b = Uint8Array.from([1, 1, 1, 2, 1, 1]);
  assert.deepEqual(search(b, Uint8Array.from([1, 1])), [0, 1, 4]);
  assert.deepEqual(search(b, Uint8Array.from([2])), [3]);
  assert.deepEqual(search(b, Uint8Array.from([])), []);
  assert.deepEqual(search(b, Uint8Array.from([1, 1, 1, 2, 1, 1, 1])), []);
});

test('inspector reads both endians', () => {
  const b = Uint8Array.from([0x00, 0x00, 0x80, 0x3f, 0xff, 0xff, 0xff, 0xff]);
  const r = Object.fromEntries(inspect(b, 0).map((x: any) => [x.name, x]));
  assert.equal(r.u8.le, '0');
  assert.equal(r.f32.le, '1');
  assert.equal(r.u32.le, '1065353216');
  assert.equal(r.u32.be, '32831');
  assert.equal(r.i64.le, '-3229614080');
  const at4 = Object.fromEntries(inspect(b, 4).map((x: any) => [x.name, x]));
  assert.equal(at4.i32.le, '-1');
  assert.equal(at4.u32.be, '4294967295');
  assert.equal(at4.f32.le, 'NaN');
  assert.equal(at4.f64.le, null);
  const f64 = Object.fromEntries(inspect(Uint8Array.from([0x40, 0x09, 0x21, 0xfb, 0x54, 0x44, 0x2d, 0x18]), 0).map((x: any) => [x.name, x]));
  assert.equal(f64.f64.be, String(Math.PI));
  assert.equal(f64.u16.be, String(0x4009));
  assert.equal(f64.u16.le, String(0x0940));
});

test('review fixes: long 0x literal, braces in decimal, hexdump "*" rows', () => {
  assert.equal(toHex(parseHex('0x48656c6c6f')), '48 65 6c 6c 6f');
  assert.equal(toHex(parseDecimal('{72, 101}')), '48 65');
  assert.throws(() => parseHex('00000000  00 00 00 00 00 00 00 00  00 00 00 00 00 00 00 00  |................|\n*\n00000020\n'), /hexdump -Cv/);
});
