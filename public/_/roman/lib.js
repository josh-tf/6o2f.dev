// Roman numerals and English number words. Pure functions, no DOM.

const ROMAN = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];
const VAL = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
const BAR = '̅'; // combining overline: a vinculum multiplies by 1000

/** 1..3999 → canonical numeral. Throws a readable error outside that range. */
export function toRoman(n) {
  if (!Number.isInteger(n)) throw new Error('Roman numerals have no fractions: use a whole number.');
  if (n === 0) throw new Error('There is no Roman numeral for zero (medieval texts wrote "nulla" or N).');
  if (n < 0) throw new Error('Roman numerals have no negative numbers.');
  if (n > 3999) throw new Error('Standard numerals stop at 3999 (MMMCMXCIX). See the vinculum form below for larger values.');
  let out = '';
  for (const [v, s] of ROMAN)
    while (n >= v) {
      out += s;
      n -= v;
    }
  return out;
}

/** 4000..3,999,999 in vinculum notation: an overline multiplies a numeral by 1000 (e.g. 5000 = V̅). */
export function toVinculum(n) {
  if (!Number.isInteger(n) || n < 1 || n > 3999999) throw new Error('The vinculum form covers 1 to 3,999,999.');
  const hi = Math.floor(n / 1000),
    lo = n % 1000;
  if (hi < 4) return toRoman(n); // MMM… is still standard below 4000
  return [...toRoman(hi)].map((c) => c + BAR).join('') + (lo ? toRoman(lo) : '');
}

/** Parse a numeral. Returns { value, canonical, issues } where issues explain non-canonical spellings. */
export function fromRoman(input) {
  const s = String(input).trim().toUpperCase();
  if (!s) throw new Error('Type a numeral such as XIV.');
  const bad = [...s].find((c) => !VAL[c]);
  if (bad) throw new Error(`"${bad}" is not a Roman numeral letter. Use I, V, X, L, C, D and M.`);
  let value = 0;
  for (let i = 0; i < s.length; i++) {
    const v = VAL[s[i]],
      next = VAL[s[i + 1]] || 0;
    value += v < next ? -v : v;
  }
  const issues = [];
  const runs = s.match(/(.)\1*/g) || [];
  for (const r of runs) {
    if ('VLD'.includes(r[0]) && r.length > 1) issues.push(`${r[0]} is never repeated: ${r} is written ${toRoman(VAL[r[0]] * r.length)}.`);
    else if (r.length > 3)
      issues.push(
        `${r} repeats ${r[0]} ${r.length} times; at most three in a row are allowed${r === 'IIII' ? ' (IIII is a clock-face form, the standard is IV)' : ''}.`,
      );
  }
  for (let i = 0; i < s.length - 1; i++) {
    const a = VAL[s[i]],
      b = VAL[s[i + 1]];
    if (a >= b) continue;
    const pair = s[i] + s[i + 1];
    if (!['IV', 'IX', 'XL', 'XC', 'CD', 'CM'].includes(pair))
      issues.push(`${pair} is not a valid subtraction: only I, X and C subtract, and only from the next two larger letters (IV IX, XL XC, CD CM).`);
    else if (i > 0 && VAL[s[i - 1]] <= a) issues.push(`${s[i - 1]}${pair}: a subtracted letter cannot follow a letter of equal or smaller value.`);
  }
  if (value < 1) throw new Error(`${s} does not read as a positive number.`);
  const canonical = value <= 3999 ? toRoman(value) : null;
  if (canonical && canonical !== s && !issues.length)
    issues.push(`The letters are out of the standard order. Read with the subtraction rule it is ${value}, written ${canonical}.`);
  if (!canonical) issues.push(`${value} is above 3999, which standard numerals cannot write.`);
  return { value, canonical, issues };
}

// ---------- English words ----------
const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion'];
export const MAX = 10n ** 15n;

/** Normalise "1,234.5", "-1e15", "1 000" → { neg, int: bigint, frac: digit string }. Throws on junk. */
export function parseNumber(input) {
  let s = String(input)
    .trim()
    .replace(/[,_\s]/g, '')
    .replace(/^−/, '-');
  if (!s) throw new Error('Type a number.');
  const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(s);
  if (!m || (!m[2] && !m[3])) throw new Error(`"${input}" is not a number. Use digits, e.g. 1234.56 or 1e6.`);
  let int = m[2] || '0',
    frac = m[3] || '';
  const exp = Number(m[4] || 0);
  if (Math.abs(exp) > 30) throw new Error(`The exponent e${m[4]} is out of range: words go up to 10^15.`);
  if (exp > 0) {
    const take = frac.slice(0, exp).padEnd(exp, '0');
    int += take;
    frac = frac.slice(exp);
  } else if (exp < 0) {
    const k = -exp;
    const pad = int.padStart(k + 1, '0');
    frac = pad.slice(-k) + frac;
    int = pad.slice(0, -k);
  }
  frac = frac.replace(/0+$/, '');
  const n = BigInt(int);
  return { neg: m[1] === '-' && (n > 0n || frac !== ''), int: n, frac };
}

function under1000(n, british) {
  const h = Math.floor(n / 100),
    r = n % 100,
    parts = [];
  if (h) parts.push(`${ONES[h]} hundred`);
  if (r) {
    const t = r < 20 ? ONES[r] : TENS[Math.floor(r / 10)] + (r % 10 ? `-${ONES[r % 10]}` : '');
    parts.push(h && british ? `and ${t}` : t);
  }
  return parts.join(' ');
}

/** Whole number (bigint, |n| ≤ 10^15) → words. British adds "and" after hundreds and before a final part under 100. */
export function intToWords(n, { british = false } = {}) {
  if (n < 0n) return `minus ${intToWords(-n, { british })}`;
  if (n > MAX) throw new Error('Words go up to one quadrillion (10^15).');
  if (n === 0n) return 'zero';
  const groups = [];
  for (let x = n; x > 0n; x /= 1000n) groups.push(Number(x % 1000n));
  const parts = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (!g) continue;
    let w = under1000(g, british);
    if (british && i === 0 && g < 100 && groups.length > 1) w = `and ${w}`;
    parts.push(SCALES[i] ? `${w} ${SCALES[i]}` : w);
  }
  return parts.join(' ');
}

/** Cardinal words for any parseNumber() input, decimals read digit by digit ("three point one four"). */
export function toWords(input, opts = {}) {
  const { neg, int, frac } = parseNumber(input);
  let w = intToWords(int, opts);
  if (frac) w += ' point ' + [...frac].map((d) => ONES[+d]).join(' ');
  return neg ? `minus ${w}` : w;
}

const ORD = { one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth', twelve: 'twelfth' };
/** "twenty-one" → "twenty-first". */
export function ordinalWords(words) {
  return words.replace(/([a-z]+)$/, (w) => ORD[w] || (w.endsWith('y') ? w.slice(0, -1) + 'ieth' : w + 'th'));
}
/** 21 → "21st", 112 → "112th". */
export function ordinalSuffix(n) {
  const a = (n < 0n ? -n : n) % 100n,
    b = a % 10n;
  return `${n}${a >= 11n && a <= 13n ? 'th' : b === 1n ? 'st' : b === 2n ? 'nd' : b === 3n ? 'rd' : 'th'}`;
}

export const CURRENCIES = {
  dollars: ['dollar', 'dollars', 'cent', 'cents'],
  euros: ['euro', 'euros', 'cent', 'cents'],
  pounds: ['pound', 'pounds', 'penny', 'pence'],
};
/** Cheque wording: "One hundred twenty-three dollars and forty-five cents" plus the "and 45/100" form. Rounds to cents (half up). */
export function chequeWords(input, currency = 'dollars', opts = {}) {
  const { neg, int, frac } = parseNumber(input);
  if (neg) throw new Error('A cheque amount cannot be negative.');
  let cents = Number((frac + '000').slice(0, 3));
  cents = Math.round(cents / 10);
  let whole = int;
  if (cents === 100) {
    whole += 1n;
    cents = 0;
  }
  const [one, many, c1, cn] = CURRENCIES[currency] || CURRENCIES.dollars;
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const main = `${intToWords(whole, opts)} ${whole === 1n ? one : many}`;
  const words = cap(cents ? `${main} and ${intToWords(BigInt(cents), opts)} ${cents === 1 ? c1 : cn}` : `${main} only`);
  const fraction = cap(`${intToWords(whole, opts)} and ${String(cents).padStart(2, '0')}/100 ${many}`);
  return { words, fraction, amount: `${whole.toLocaleString('en')}.${String(cents).padStart(2, '0')}` };
}

// ---------- words → number ----------
const SMALL = Object.fromEntries([...ONES.map((w, i) => [w, i]), ...TENS.map((w, i) => [w, i * 10]).filter(([w]) => w)]);
const ORDW = Object.fromEntries(Object.entries(SMALL).map(([w, v]) => [ORD[w] || (w.endsWith('y') ? w.slice(0, -1) + 'ieth' : w + 'th'), v]));
ORDW.zeroth = 0;
const BIG = { thousand: 1000n, million: 10n ** 6n, billion: 10n ** 9n, trillion: 10n ** 12n, quadrillion: 10n ** 15n };

/** "twenty-one thousand and five" → { value: 21005n, ordinal: false }. Accepts "a hundred", "minus", ordinals, "point". */
export function fromWords(input) {
  const toks = String(input).toLowerCase().replace(/[,]/g, ' ').replace(/-/g, ' ').split(/\s+/).filter(Boolean);
  if (!toks.length) throw new Error('Type a number in words, e.g. "two hundred and five".');
  let neg = false,
    total = 0n,
    cur = 0n,
    seen = false,
    ordinal = false,
    frac = '',
    prev = '';
  // Below a hundred only "tens-units" combines ("fifty four"); "five four" or "nine eleven" is two numbers, not one.
  const add = (v, word) => {
    const low = cur % 100n;
    if (low && !(low >= 20n && low % 10n === 0n && v >= 1n && v <= 9n))
      throw new Error(`"${prev} ${word}" is not one number; write it like "fifty-four" or "nineteen hundred eighty-four".`);
    cur += v;
    seen = true;
  };
  for (let i = 0; i < toks.length; i++) {
    let t = toks[i];
    if (t === 'and') continue;
    if (i === 0 && (t === 'minus' || t === 'negative')) {
      neg = true;
      continue;
    }
    if (i === 0 && (t === 'a' || t === 'an') && (toks[1] in BIG || /^hundred(th)?s?$/.test(toks[1] || ''))) {
      cur = 1n;
      seen = true;
      continue;
    }
    if (t === 'point') {
      for (const d of toks.slice(i + 1)) {
        if (!(d in SMALL) || SMALL[d] > 9) throw new Error(`After "point" use single digits ("three point one four"), not "${d}".`);
        frac += SMALL[d];
      }
      if (!frac) throw new Error('"point" needs digits after it.');
      break;
    }
    if (i === toks.length - 1 && !(t in SMALL) && !(t in BIG) && t !== 'hundred') {
      const base = t in ORDW ? t : t.replace(/ths?$/, '');
      if (t in ORDW) {
        ordinal = true;
        add(BigInt(ORDW[t]), t);
        total += cur;
        cur = 0n;
        continue;
      }
      if (base === 'hundred' || base in BIG) {
        ordinal = true;
        t = base;
      }
    }
    if (t in SMALL) add(BigInt(SMALL[t]), t);
    else if (t === 'hundred') {
      cur = (cur || 1n) * 100n;
      seen = true;
    } else if (t in BIG) {
      const m = BIG[t];
      total += (cur || 1n) * m;
      cur = 0n;
      seen = true;
    } else throw new Error(`"${toks[i]}" is not a number word I know. Use words like "one", "twenty", "hundred", "million".`);
    prev = toks[i];
  }
  if (!seen) throw new Error('No number words found.');
  const value = total + cur;
  return { value: neg ? -value : value, frac, ordinal, neg };
}
