import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { encode, decode, timing, unitMs, segments, totalMs, pcm, wav, decodeTaps, looksLikeMorse } from '../../../public/_/morse/lib.js';

test('encode letters, digits, punctuation, prosigns', () => {
  assert.equal(encode('SOS').morse, '... --- ...');
  assert.equal(encode('Hello World').morse, '.... . .-.. .-.. --- / .-- --- .-. .-.. -..');
  assert.equal(encode('CQ 73!').morse, '-.-. --.- / --... ...-- -.-.--');
  assert.equal(encode('a@b.com').morse, '.- .--.-. -... .-.-.- -.-. --- --');
  assert.equal(encode('<SOS> <ar>').morse, '...---... / .-.-.');
  assert.equal(encode('café').morse, '-.-. .- ..-. .');
  assert.deepEqual(encode('hi # ~').unknown, ['#', '~']);
  assert.equal(encode('   ').morse, '');
});
test('decode, separators and unknowns', () => {
  assert.equal(decode('.... . .-.. .-.. --- / .-- --- .-. .-.. -..').text, 'HELLO WORLD');
  assert.equal(decode('·–·· ·|·––·').text, 'LE P');
  assert.equal(decode('... ---   ...').text, 'SO S');
  assert.deepEqual(decode('.... ......').bad, 1);
  assert.equal(decode('...---...').text, '<SOS>');
  for (const t of ['THE QUICK BROWN FOX 0123456789 .,?\'!/()&:;=+-_"$@']) assert.equal(decode(encode(t).morse).text, t);
  assert.ok(looksLikeMorse('... --- ...') && !looksLikeMorse('Hi.') && !looksLikeMorse('...abc'));
});
test('PARIS timing: 50 units per word, Farnsworth keeps the overall speed', () => {
  assert.equal(unitMs(20), 60);
  const paris = encode('PARIS').morse;
  // standard: PARIS followed by a word gap is exactly 50 units
  assert.equal(totalMs(segments(`${paris} / ${paris}`, 20)) - totalMs(segments(paris, 20)), 50 * 60);
  const fw = timing(10, 20); // 20 wpm characters, 10 wpm overall
  assert.equal(fw.unit, 60);
  assert.ok(Math.abs(fw.gapUnit * 19 + fw.unit * 31 - 6000) < 1e-9);
  const twice = totalMs(segments(`${paris} / ${paris}`, 10, 20)) - totalMs(segments(paris, 10, 20));
  assert.ok(Math.abs(twice - 6000) < 1e-6);
  assert.equal(timing(15, 10).gapUnit, 80); // overall faster than characters: clamps to plain speed
});
test('segments shape', () => {
  const s = segments('.-', 20);
  assert.deepEqual(s, [
    { on: true, ms: 60 },
    { on: false, ms: 60 },
    { on: true, ms: 180 },
  ]);
  assert.equal(segments('', 20).length, 0);
});
test('pcm and wav header', () => {
  const s = pcm(segments('.', 20), { rate: 8000 });
  assert.equal(s.length, 480);
  assert.equal(s[0], 0);
  assert.ok(Math.max(...s) > 0.4);
  const w = wav(s, 8000),
    dv = new DataView(w.buffer);
  assert.equal(String.fromCharCode(...w.slice(0, 4)), 'RIFF');
  assert.equal(dv.getUint32(24, true), 8000);
  assert.equal(dv.getUint32(40, true), 960);
  assert.equal(w.length, 44 + 960);
});
test('tap decoding', () => {
  const u = 100;
  let t = 0;
  const p: any[] = [];
  const press = (d: number, gapBefore: number) => {
    t += gapBefore;
    p.push({ down: t, up: t + d });
    t += d;
  };
  // "SO" then word gap then "E": ... --- / .
  [
    [100, 0],
    [100, 100],
    [100, 100],
    [300, 300],
    [300, 100],
    [300, 100],
    [100, 700],
  ].forEach(([d, g]) => press(d, g));
  assert.deepEqual(decodeTaps(p, u), { morse: '... --- / .', text: 'SO E' });
  assert.deepEqual(decodeTaps([], u), { morse: '', text: '' });
});
