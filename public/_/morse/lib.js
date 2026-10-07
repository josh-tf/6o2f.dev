// International Morse (ITU-R M.1677-1): encode/decode, PARIS timing with Farnsworth, PCM + WAV, and a tap decoder.
const T = {
  A: '.-',
  B: '-...',
  C: '-.-.',
  D: '-..',
  E: '.',
  F: '..-.',
  G: '--.',
  H: '....',
  I: '..',
  J: '.---',
  K: '-.-',
  L: '.-..',
  M: '--',
  N: '-.',
  O: '---',
  P: '.--.',
  Q: '--.-',
  R: '.-.',
  S: '...',
  T: '-',
  U: '..-',
  V: '...-',
  W: '.--',
  X: '-..-',
  Y: '-.--',
  Z: '--..',
  0: '-----',
  1: '.----',
  2: '..---',
  3: '...--',
  4: '....-',
  5: '.....',
  6: '-....',
  7: '--...',
  8: '---..',
  9: '----.',
  '.': '.-.-.-',
  ',': '--..--',
  '?': '..--..',
  "'": '.----.',
  '!': '-.-.--',
  '/': '-..-.',
  '(': '-.--.',
  ')': '-.--.-',
  '&': '.-...',
  ':': '---...',
  ';': '-.-.-.',
  '=': '-...-',
  '+': '.-.-.',
  '-': '-....-',
  _: '..--.-',
  '"': '.-..-.',
  $: '...-..-',
  '@': '.--.-.',
};
export const MORSE = T;
/** Prosigns, written <AR> in text. Sent as one unbroken character. */
export const PROSIGNS = {
  AR: '.-.-.',
  AS: '.-...',
  BT: '-...-',
  KN: '-.--.',
  SK: '...-.-',
  KA: '-.-.-',
  CT: '-.-.-',
  SOS: '...---...',
  HH: '........',
  BK: '-...-.-',
  VE: '...-.',
};
const REV = {};
for (const [k, v] of Object.entries(T)) REV[v] = k;
for (const k of ['SK', 'KA', 'SOS', 'HH', 'BK']) REV[PROSIGNS[k]] = `<${k}>`; // not already a punctuation mark

/** Text -> Morse: letters separated by a space, words by " / ". Unsupported characters are listed in `unknown` and skipped. */
export function encode(text) {
  const unknown = new Set(),
    words = [];
  for (const w of text.trim().split(/\s+/).filter(Boolean)) {
    const codes = [];
    for (const m of w.matchAll(/<([A-Za-z]{2,3})>|([\s\S])/gu)) {
      const ps = m[1] && PROSIGNS[m[1].toUpperCase()];
      if (ps) {
        codes.push(ps);
        continue;
      }
      for (const ch of m[0].normalize('NFD').replace(/[̀-ͯ]/g, '')) {
        // fold accents: é -> e
        const c = T[ch.toUpperCase()];
        if (c) codes.push(c);
        else if (ch.trim()) unknown.add(ch);
      }
    }
    if (codes.length) words.push(codes.join(' '));
  }
  return { morse: words.join(' / '), unknown: [...unknown] };
}

/** Is this string Morse (only dots, dashes, separators) rather than text? */
export const looksLikeMorse = (s) => /[.\-•·–—−]/.test(s) && /^[.\-•·–—−/|\s]+$/.test(s);
export const normalizeMorse = (s) => s.replace(/[•·]/g, '.').replace(/[–—−]/g, '-').replace(/\|/g, '/');

/** Morse -> text. Separators: spaces between letters, "/" (or 3+ spaces) between words. Unknown groups become "?". */
export function decode(morse) {
  const words = normalizeMorse(morse)
    .trim()
    .split(/\s*\/\s*|\s{3,}/);
  let bad = 0;
  const text = words
    .map((w) =>
      w
        .split(/\s+/)
        .filter(Boolean)
        .map((g) => REV[g] ?? (bad++, '?'))
        .join(''),
    )
    .filter(Boolean)
    .join(' ');
  return { text, bad };
}

// ---- timing --------------------------------------------------------------
/** One dot, in ms, at `wpm` words per minute (the word PARIS = 50 units). */
export const unitMs = (wpm) => 1200 / wpm;
/** Farnsworth: characters sent at `charWpm`, overall speed `wpm` (<= charWpm). Gap unit stretches so PARIS takes 60/wpm seconds. */
export function timing(wpm, charWpm = wpm) {
  const c = Math.max(charWpm, wpm),
    unit = 1200 / c;
  const gapUnit = c === wpm ? unit : (60000 / wpm - 31 * unit) / 19; // PARIS = 31 units inside characters + 19 units of gaps
  return { unit, gapUnit, wordMs: 60000 / wpm };
}
/** Morse string -> [{on, ms}]. Dot 1u, dash 3u, element gap 1u, letter gap 3 gap-units, word gap 7 gap-units. */
export function segments(morse, wpm, charWpm = wpm) {
  const { unit, gapUnit } = timing(wpm, charWpm),
    out = [];
  const gap = (ms) => {
    if (out.length) {
      const l = out[out.length - 1];
      if (!l.on) l.ms += ms;
      else out.push({ on: false, ms });
    }
  };
  normalizeMorse(morse)
    .trim()
    .split(/\s*\/\s*/)
    .forEach((w, wi) => {
      if (wi) gap(7 * gapUnit);
      w.split(/\s+/)
        .filter(Boolean)
        .forEach((g, gi) => {
          if (gi) gap(3 * gapUnit);
          [...g].forEach((e, ei) => {
            if (ei) gap(unit);
            if (e === '.' || e === '-') out.push({ on: true, ms: e === '.' ? unit : 3 * unit });
          });
        });
    });
  return out;
}
export const totalMs = (segs) => segs.reduce((t, s) => t + s.ms, 0);

// ---- audio ---------------------------------------------------------------
/** Float32 samples in -1..1: a sine tone for each "on" segment with 5 ms raised-cosine edges (no key clicks). */
export function pcm(segs, { freq = 600, vol = 0.5, rate = 22050 } = {}) {
  const n = Math.round((totalMs(segs) / 1000) * rate),
    out = new Float32Array(n),
    ramp = Math.round(0.005 * rate);
  let t = 0;
  for (const s of segs) {
    const a = Math.round((t / 1000) * rate),
      b = Math.min(n, Math.round(((t + s.ms) / 1000) * rate));
    if (s.on)
      for (let i = a; i < b; i++) {
        const edge = Math.min(i - a, b - 1 - i, ramp),
          env = edge < ramp ? 0.5 - 0.5 * Math.cos((Math.PI * edge) / ramp) : 1;
        out[i] = Math.sin((2 * Math.PI * freq * (i - a)) / rate) * vol * env;
      }
    t += s.ms;
  }
  return out;
}
/** 16-bit mono PCM WAV file bytes. */
export function wav(samples, rate = 22050) {
  const n = samples.length,
    b = new Uint8Array(44 + n * 2),
    v = new DataView(b.buffer);
  const str = (o, s) => [...s].forEach((c, i) => (b[o + i] = c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  str(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), true);
  return b;
}

// ---- tap keying ----------------------------------------------------------
/** presses = [{down, up}] in ms timestamps. Press < 2 units = dot, else dash; gap >= 5 units = new word, >= 2 units = new letter. */
export function decodeTaps(presses, unit) {
  let morse = '';
  presses.forEach((p, i) => {
    if (i) {
      const g = p.down - presses[i - 1].up;
      morse += g >= 5 * unit ? ' / ' : g >= 2 * unit ? ' ' : '';
    }
    morse += p.up - p.down < 2 * unit ? '.' : '-';
  });
  return { morse, text: morse ? decode(morse).text : '' };
}
