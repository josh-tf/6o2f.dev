import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { TABLE, extOf, typesForExt, lookupType, header, search, sniff } from '../../../public/_/mime/lib.js';

const B = (...xs: (number | string)[]) => {
  const out: number[] = [];
  for (const x of xs) typeof x === 'string' ? out.push(...[...x].map((c) => c.charCodeAt(0))) : out.push(x);
  return new Uint8Array(out);
};
const pad = (b: Uint8Array, n = 600) => {
  const o = new Uint8Array(Math.max(n, b.length));
  o.set(b);
  return o;
};

test('table', () => {
  assert.ok(TABLE.length >= 300, `only ${TABLE.length}`);
  const types = TABLE.map((r: any) => r.type);
  assert.equal(new Set(types).size, types.length, 'duplicate types');
  for (const r of TABLE) assert.match(r.type, /^[a-z]+\/[a-z0-9.+-]+$/i, r.type);
});
test('extension to type', () => {
  assert.equal(extOf('photo.JPG'), 'jpg');
  assert.equal(extOf('.png'), 'png');
  assert.equal(extOf('png'), 'png');
  assert.equal(extOf('archive.tar.gz'), 'gz');
  assert.equal(extOf('/a/b.d/Makefile'), 'makefile');
  assert.equal(extOf('README'), 'readme');
  assert.equal(extOf('.bashrc'), 'bashrc');
  assert.equal(extOf('ls', false), '');
  assert.equal(extOf('.bashrc', false), '');
  assert.equal(extOf('a.PNG', false), 'png');
  assert.equal(extOf('dir/file.'), '');
  assert.equal(extOf(''), '');
  assert.equal(typesForExt('png')[0], 'image/png');
  assert.equal(typesForExt('.JS')[0], 'text/javascript');
  assert.equal(typesForExt('mjs')[0], 'text/javascript');
  assert.equal(typesForExt('json')[0], 'application/json');
  assert.equal(typesForExt('svg')[0], 'image/svg+xml');
  assert.equal(typesForExt('woff2')[0], 'font/woff2');
  assert.equal(typesForExt('docx')[0], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  assert.equal(typesForExt('mp3')[0], 'audio/mpeg');
  assert.equal(typesForExt('wasm')[0], 'application/wasm');
  assert.deepEqual(typesForExt('ts'), ['video/mp2t', 'application/typescript']);
  assert.deepEqual(typesForExt('nope'), []);
});
test('type to extensions', () => {
  assert.deepEqual(lookupType('image/jpeg').exts.slice(0, 2), ['jpg', 'jpeg']);
  assert.equal(lookupType('TEXT/HTML; charset=UTF-8').type, 'text/html');
  const a = lookupType('application/javascript');
  assert.equal(a.type, 'text/javascript');
  assert.equal(a.alias, 'application/javascript');
  assert.ok(a.exts.includes('js'));
  assert.equal(lookupType('audio/x-wav').type, 'audio/wav');
  assert.equal(lookupType('nope/never'), null);
  assert.equal(lookupType(''), null);
});
test('content-type header', () => {
  assert.equal(header('text/html'), 'Content-Type: text/html; charset=utf-8');
  assert.equal(header('application/json'), 'Content-Type: application/json; charset=utf-8');
  assert.equal(header('application/ld+json'), 'Content-Type: application/ld+json; charset=utf-8');
  assert.equal(header('image/svg+xml'), 'Content-Type: image/svg+xml; charset=utf-8');
  assert.equal(header('image/png'), 'Content-Type: image/png');
  assert.equal(header('application/zip'), 'Content-Type: application/zip');
});
test('search', () => {
  assert.equal(search('png')[0].type, 'image/png');
  assert.equal(search('.webp')[0].type, 'image/webp');
  assert.ok(search('opendocument').length >= 5);
  assert.ok(search('', 'Fonts').every((r: any) => r.cat === 'Fonts'));
  assert.equal(search('zzzzqq').length, 0);
});
test('signatures', () => {
  const cases: [Uint8Array, string, string][] = [
    [B(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 'IHDR'), 'x.png', 'image/png'],
    [B(0xff, 0xd8, 0xff, 0xe0, 0, 16, 'JFIF'), 'x.jpg', 'image/jpeg'],
    [B('GIF89a'), 'x.gif', 'image/gif'],
    [B('RIFF', 0, 0, 0, 0, 'WEBPVP8 '), 'x.webp', 'image/webp'],
    [B('RIFF', 0, 0, 0, 0, 'WAVEfmt '), 'x.wav', 'audio/wav'],
    [B('%PDF-1.7\n'), 'x.pdf', 'application/pdf'],
    [B('PK', 3, 4, 20, 0), 'x.zip', 'application/zip'],
    [B(0x1f, 0x8b, 8, 0), 'x.gz', 'application/gzip'],
    [B(0, 0, 0, 0x20, 'ftypisom', 0, 0, 2, 0), 'x.mp4', 'video/mp4'],
    [B(0, 0, 0, 0x1c, 'ftypavif'), 'x.avif', 'image/avif'],
    [B(0, 0, 0, 0x14, 'ftypqt  '), 'x.mov', 'video/quicktime'],
    [B('ID3', 4, 0), 'x.mp3', 'audio/mpeg'],
    [B(0xff, 0xfb, 0x90, 0x64), 'x.mp3', 'audio/mpeg'],
    [B('OggS', 0, 2), 'x.ogg', 'audio/ogg'],
    [B('fLaC'), 'x.flac', 'audio/flac'],
    [B('wOFF', 0, 1, 0, 0), 'x.woff', 'font/woff'],
    [B('wOF2', 0, 1, 0, 0), 'x.woff2', 'font/woff2'],
    [B('SQLite format 3', 0), 'x.db', 'application/vnd.sqlite3'],
    [B('MZ', 0x90, 0), 'x.exe', 'application/x-msdownload'],
    [B(0x7f, 'ELF', 2, 1, 1), 'ls', 'application/x-elf'],
    [B(0, 0, 1, 0, 1, 0, 16, 16), 'favicon.ico', 'image/x-icon'],
    [pad(B('BM', 0x36, 0, 0, 0)), 'x.bmp', 'image/bmp'],
    [B('II*', 0), 'x.tif', 'image/tiff'],
    [B('MM', 0, '*'), 'x.tiff', 'image/tiff'],
    [B('7z', 0xbc, 0xaf, 0x27, 0x1c), 'x.7z', 'application/x-7z-compressed'],
    [B('Rar!', 0x1a, 7, 1, 0), 'x.rar', 'application/vnd.rar'],
    [B(0xfd, '7zXZ', 0), 'x.xz', 'application/x-xz'],
    [B('BZh9'), 'x.bz2', 'application/x-bzip2'],
    [B(0x28, 0xb5, 0x2f, 0xfd), 'x.zst', 'application/zstd'],
    [B(0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x84, 'webm'), 'x.webm', 'video/webm'],
    [B(0, 'asm', 1, 0, 0, 0), 'x.wasm', 'application/wasm'],
    [B(0, 1, 0, 0, 0, 0x10), 'x.ttf', 'font/ttf'],
    [B('OTTO'), 'x.otf', 'font/otf'],
    [B('8BPS', 0, 1), 'x.psd', 'image/vnd.adobe.photoshop'],
    [B(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1), 'x.doc', 'application/x-ole-storage'],
    [B(0xca, 0xfe, 0xba, 0xbe, 0, 0, 0, 52), 'A.class', 'application/java-vm'],
    [B('<!DOCTYPE html><html>'), 'x.html', 'text/html'],
    [B('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>'), 'x.svg', 'image/svg+xml'],
  ];
  for (const [b, name, type] of cases) {
    const r = sniff(b, name);
    assert.equal(r.type, type, name);
    assert.equal(r.verdict, 'match', `${name} verdict ${r.verdict}`);
  }
  const tar = new Uint8Array(512);
  tar.set(B('ustar'), 257);
  assert.equal(sniff(tar, 'a.tar').type, 'application/x-tar');
  // OOXML: zip with [Content_Types].xml and word/
  const docx = B('PK', 3, 4, 20, 0, 6, 0, 8, 0, ...new Array(18).fill(0), '[Content_Types].xml', 'PK', 3, 4, 'word/document.xml');
  const d = sniff(docx, 'report.docx');
  assert.match(d.type, /wordprocessingml/);
  assert.equal(d.verdict, 'match');
  assert.equal(sniff(B('PK', 3, 4), 'book.epub').verdict, 'match'); // generic zip accepted for zip-based formats
});
test('mismatch and edge cases', () => {
  const png = B(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a);
  const r = sniff(png, 'photo.jpg');
  assert.equal(r.verdict, 'mismatch');
  assert.equal(r.type, 'image/png');
  assert.equal(r.expected[0], 'image/jpeg');
  assert.equal(sniff(png, 'photo').verdict, 'noext');
  assert.equal(sniff(B('MZ'), 'invoice.pdf').verdict, 'mismatch');
  assert.equal(sniff(new Uint8Array(0), 'x.bin').verdict, 'unknown');
  assert.equal(sniff(B(1, 2, 3, 0, 5, 6), 'x.bin').verdict, 'unknown');
  assert.equal(sniff(B('hello,world\n1,2\n'), 'data.csv').verdict, 'text');
  assert.equal(sniff(B('just text'), 'x.png').verdict, 'mismatch');
  assert.equal(sniff(B('#!/bin/sh\necho hi\n'), 'run.sh').type, 'text/plain');
  assert.equal(sniff(B(0xef, 0xbb, 0xbf, 'hi'), 'a.txt').verdict, 'text');
});

test('review fixes: text starting with "BM" or "G" is not BMP or MPEG-TS', () => {
  const t = (s: string) => new TextEncoder().encode(s);
  assert.equal(sniff(t('BMW service notes: oil change at 15000 km\n'), 'notes.txt').verdict, 'text');
  assert.equal(sniff(t('G' + 'x'.repeat(187) + 'G' + 'y'.repeat(400)), 'g.md').verdict, 'text'); // 0x47 at 0 and 188 only
  assert.equal(sniff(new Uint8Array(0), 'empty.txt').verdict, 'unknown');
});
