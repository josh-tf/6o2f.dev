import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import {
  toRoman,
  toVinculum,
  fromRoman,
  toWords,
  intToWords,
  ordinalWords,
  ordinalSuffix,
  chequeWords,
  fromWords,
  parseNumber,
} from '../../../public/_/roman/lib.js';

test('number to roman edge cases', () => {
  const cases: [number, string][] = [
    [1, 'I'],
    [4, 'IV'],
    [9, 'IX'],
    [14, 'XIV'],
    [40, 'XL'],
    [90, 'XC'],
    [400, 'CD'],
    [900, 'CM'],
    [1994, 'MCMXCIV'],
    [2024, 'MMXXIV'],
    [3999, 'MMMCMXCIX'],
  ];
  for (const [n, r] of cases) {
    assert.equal(toRoman(n), r);
    assert.equal(fromRoman(r).value, n);
    assert.deepEqual(fromRoman(r).issues, []);
  }
  assert.throws(() => toRoman(0), /zero/);
  assert.throws(() => toRoman(-5), /negative/);
  assert.throws(() => toRoman(4000), /3999/);
  assert.throws(() => toRoman(1.5), /fractions/);
});

test('every value round-trips', () => {
  for (let n = 1; n <= 3999; n++) assert.equal(fromRoman(toRoman(n)).canonical, toRoman(n));
});

test('vinculum for large values', () => {
  assert.equal(toVinculum(4000), 'I̅V̅');
  assert.equal(toVinculum(5001), 'V̅I');
  assert.equal(toVinculum(3999), 'MMMCMXCIX');
});

test('non-canonical forms are flagged with the canonical form', () => {
  const four = fromRoman('IIII');
  assert.equal(four.value, 4);
  assert.equal(four.canonical, 'IV');
  assert.match(four.issues[0], /three/);
  const il = fromRoman('IL');
  assert.equal(il.value, 49);
  assert.equal(il.canonical, 'XLIX');
  assert.match(il.issues[0], /not a valid subtraction/);
  assert.match(fromRoman('VV').issues[0], /never repeated.*X/);
  assert.equal(fromRoman('mcmxciv').value, 1994);
  assert.throws(() => fromRoman('XIA'), /"A" is not/);
  assert.throws(() => fromRoman(''), /Type/);
  assert.ok(fromRoman('IIV').issues.length > 0);
});

test('cardinal words', () => {
  assert.equal(toWords('0'), 'zero');
  assert.equal(toWords('-7'), 'minus seven');
  assert.equal(toWords('21'), 'twenty-one');
  assert.equal(toWords('101'), 'one hundred one');
  assert.equal(toWords('101', { british: true }), 'one hundred and one');
  assert.equal(toWords('1005', { british: true }), 'one thousand and five');
  assert.equal(toWords('1000105', { british: true }), 'one million one hundred and five');
  assert.equal(toWords('1,234,567'), 'one million two hundred thirty-four thousand five hundred sixty-seven');
  assert.equal(toWords('1e15'), 'one quadrillion');
  assert.equal(
    toWords('999999999999999'),
    'nine hundred ninety-nine trillion nine hundred ninety-nine billion nine hundred ninety-nine million nine hundred ninety-nine thousand nine hundred ninety-nine',
  );
  assert.equal(toWords('3.14'), 'three point one four');
  assert.equal(toWords('-0'), 'zero');
  assert.throws(() => toWords('1000000000000001'), /quadrillion/);
  assert.throws(() => toWords('12abc'), /not a number/);
  assert.equal(intToWords(-1000000n), 'minus one million');
});

test('number parsing', () => {
  assert.deepEqual(parseNumber('1.5e3'), { neg: false, int: 1500n, frac: '' });
  assert.deepEqual(parseNumber('25e-1'), { neg: false, int: 2n, frac: '5' });
  assert.deepEqual(parseNumber('−3'), { neg: true, int: 3n, frac: '' });
});

test('ordinals', () => {
  assert.equal(ordinalWords('twenty-one'), 'twenty-first');
  assert.equal(ordinalWords('twelve'), 'twelfth');
  assert.equal(ordinalWords('forty'), 'fortieth');
  assert.equal(ordinalWords('one hundred'), 'one hundredth');
  assert.equal(ordinalSuffix(21n), '21st');
  assert.equal(ordinalSuffix(11n), '11th');
  assert.equal(ordinalSuffix(112n), '112th');
  assert.equal(ordinalSuffix(103n), '103rd');
  assert.equal(ordinalSuffix(22n), '22nd');
});

test('cheque wording', () => {
  assert.equal(chequeWords('1234.56').words, 'One thousand two hundred thirty-four dollars and fifty-six cents');
  assert.equal(chequeWords('1234.56').fraction, 'One thousand two hundred thirty-four and 56/100 dollars');
  assert.equal(chequeWords('1').words, 'One dollar only');
  assert.equal(chequeWords('0.01', 'pounds').words, 'Zero pounds and one penny');
  assert.equal(chequeWords('2.999').words, 'Three dollars only');
  assert.equal(chequeWords('105', 'dollars', { british: true }).words, 'One hundred and five dollars only');
  assert.throws(() => chequeWords('-1'), /negative/);
});

test('words to number', () => {
  assert.equal(fromWords('twenty-one thousand and five').value, 21005n);
  assert.equal(fromWords('one hundred and one').value, 101n);
  assert.equal(fromWords('a hundred thousand').value, 100000n);
  assert.equal(fromWords('minus forty-two').value, -42n);
  assert.equal(fromWords('one quadrillion').value, 10n ** 15n);
  assert.equal(fromWords('Nineteen hundred eighty-four').value, 1984n);
  const o = fromWords('twenty-first');
  assert.equal(o.value, 21n);
  assert.equal(o.ordinal, true);
  assert.equal(fromWords('one hundredth').value, 100n);
  assert.equal(fromWords('three point one four').frac, '14');
  assert.throws(() => fromWords('twenty bananas'), /bananas/);
  for (const n of [0n, 7n, 15n, 99n, 100n, 101n, 999n, 1000n, 1001n, 123456789n, 10n ** 15n])
    assert.equal(fromWords(intToWords(n, { british: true })).value, n);
});

test('review fixes: words grammar, huge exponents, MMMM message', () => {
  assert.throws(() => fromWords('five four'), /not one number/);
  assert.throws(() => fromWords('nine eleven'), /not one number/);
  assert.equal(fromWords('fifty four').value, 54n);
  assert.equal(fromWords('nineteen hundred eighty-four').value, 1984n);
  assert.equal(fromWords('one hundred twenty third').value, 123n);
  assert.throws(() => toWords('1e999999999'), /out of range/);
  assert.doesNotMatch(fromRoman('MMMM').issues[0], /clock/);
});
