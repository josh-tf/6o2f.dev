// Bytes ↔ text/hex/binary/decimal, hex dump layout, search and a value inspector. Pure functions, no DOM.

const H = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

export const ENCODINGS = [
  ['utf-8', 'UTF-8'],
  ['utf-16le', 'UTF-16 LE'],
  ['utf-16be', 'UTF-16 BE'],
  ['latin1', 'Latin-1 (ISO-8859-1)'],
];

/** Text → bytes in the chosen encoding. Latin-1 rejects characters above U+00FF. */
export function encodeText(s, enc = 'utf-8') {
  if (enc === 'utf-8') return new TextEncoder().encode(s);
  if (enc === 'latin1') {
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c > 0xff) throw new Error(`"${String.fromCodePoint(s.codePointAt(i))}" (character ${i + 1}) has no Latin-1 byte. Use UTF-8 or UTF-16.`);
      out[i] = c;
    }
    return out;
  }
  const out = new Uint8Array(s.length * 2),
    be = enc === 'utf-16be';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out[2 * i + (be ? 1 : 0)] = c & 0xff;
    out[2 * i + (be ? 0 : 1)] = c >> 8;
  }
  return out;
}

/** Bytes → text. Returns { text, bad } where bad counts bytes that did not decode (shown as U+FFFD). */
export function decodeText(bytes, enc = 'utf-8') {
  if (enc === 'latin1') {
    let s = '';
    for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return { text: s, bad: 0 };
  }
  const text = new TextDecoder(enc).decode(bytes);
  let bad = 0;
  try {
    new TextDecoder(enc, { fatal: true }).decode(bytes);
  } catch {
    bad = (text.match(/�/g) || []).length || 1;
  }
  return { text, bad };
}

const posErr = (msg, src, i) => new Error(`${msg} at character ${i + 1}: "${src.slice(Math.max(0, i - 6), i + 6).replace(/\s/g, ' ')}"`);

/**
 * Hex in any common shape: "48 65 6c", "48656c", xxd -p, "0x48, 0x65", "\x48\x65", C arrays,
 * `xxd` and `hexdump -C` dumps (offset and ASCII columns are dropped).
 */
export function parseHex(src) {
  let s = src;
  if (/^\s*[0-9a-f]{6,}:\s/im.test(s) || /^\s*[0-9a-f]{8}\s\s[0-9a-f]{2}\s/im.test(s)) {
    s = s
      .split(/\r?\n/)
      .map((l) => {
        if (l.trim() === '*')
          throw new Error('The dump has a "*" line, where hexdump left out repeated rows. Run hexdump -Cv (or xxd without -a) to get every byte.');
        let m = /^\s*[0-9a-f]+:\s((?:[0-9a-f]{2,16}\s?)+?)(?:\s{2,}.*)?$/i.exec(l); // xxd
        if (m) return m[1];
        m = /^\s*[0-9a-f]{8}\s\s(.*?)\s*(?:\|.*\|)?\s*$/i.exec(l); // hexdump -C
        return m ? m[1] : /^\s*[0-9a-f]+\s*$/i.test(l) ? '' : l; // a bare final offset line
      })
      .join(' ');
  }
  const brace = s.indexOf('{');
  if (brace >= 0 && s.lastIndexOf('}') > brace) s = s.slice(brace + 1, s.lastIndexOf('}')); // C array body
  s = s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ' ');
  const tokens = s
    .replace(/\\x/gi, ' 0x')
    .split(/[\s,;:]+/)
    .filter(Boolean);
  if (tokens.some((t) => /^0x/i.test(t))) {
    const out = [];
    if (tokens.length === 1 && /^0x(?:[0-9a-f]{2})+$/i.test(tokens[0]))
      tokens.splice(
        0,
        1,
        ...tokens[0]
          .slice(2)
          .match(/../g)
          .map((h) => '0x' + h),
      ); // one long literal: 0x48656c6c6f
    for (const t of tokens) {
      const m = /^0x([0-9a-f]{1,2})$/i.exec(t);
      if (!m) throw posErr(/^0x[0-9a-f]+$/i.test(t) ? `"${t}" is more than one byte` : `"${t}" is not a 0x byte`, src, Math.max(0, src.indexOf(t)));
      out.push(parseInt(m[1], 16));
    }
    return Uint8Array.from(out);
  }
  const hex = tokens.join('');
  const bad = /[^0-9a-f]/i.exec(hex);
  if (bad) throw posErr(`"${bad[0]}" is not a hex digit`, src, src.indexOf(bad[0]));
  if (hex.length % 2) throw new Error(`Odd number of hex digits (${hex.length}): a byte is two digits, so one is missing or extra.`);
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(2 * i, 2), 16);
  return out;
}

/** "01001000 01100101" or a run of bits (multiple of 8). */
export function parseBinary(src) {
  const groups = src
    .replace(/0b/gi, ' ')
    .split(/[\s,;]+/)
    .filter(Boolean);
  const bad = groups.find((g) => /[^01]/.test(g));
  if (bad) throw posErr(`"${bad}" is not binary`, src, src.indexOf(bad));
  if (groups.every((g) => g.length <= 8) && groups.length > 1) return Uint8Array.from(groups.map((g) => parseInt(g, 2)));
  const bits = groups.join('');
  if (bits.length % 8) throw new Error(`${bits.length} bits is not a whole number of bytes. Separate bytes with spaces or give a multiple of 8 bits.`);
  return Uint8Array.from({ length: bits.length / 8 }, (_, i) => parseInt(bits.substr(i * 8, 8), 2));
}

/** "72 101 108" or "72,101,108"; each 0–255. */
export function parseDecimal(src) {
  const tokens = src.split(/[\s,;[\]{}()]+/).filter(Boolean);
  return Uint8Array.from(
    tokens.map((t) => {
      if (!/^\d+$/.test(t) || +t > 255) throw posErr(`"${t}" is not a byte (0 to 255)`, src, src.indexOf(t));
      return +t;
    }),
  );
}

export const toHex = (b, sep = ' ', upper = false) => {
  const a = new Array(b.length);
  for (let i = 0; i < b.length; i++) a[i] = H[b[i]];
  const s = a.join(sep);
  return upper ? s.toUpperCase() : s;
};
/** xxd -p: 60 hex digits (30 bytes) per line. */
export const toPlain = (b) => toHex(b, '').replace(/.{60}(?=.)/g, '$&\n');
export const toBinary = (b) => Array.from(b, (x) => x.toString(2).padStart(8, '0')).join(' ');
export const toDecimal = (b) => Array.from(b).join(' ');
export function toCArray(b, name = 'data') {
  const lines = [];
  for (let i = 0; i < b.length; i += 12) lines.push('  ' + Array.from(b.subarray(i, i + 12), (x) => `0x${H[x]}`).join(', '));
  return `unsigned char ${name}[${b.length}] = {\n${lines.join(',\n')}\n};`;
}
export function toBase64(b) {
  let s = '';
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192));
  return btoa(s);
}

const printable = (x) => x >= 0x20 && x < 0x7f;
/** Dump rows for [start, end): { offset, bytes: number[], ascii }. */
export function dumpRows(b, width = 16, start = 0, end = b.length) {
  const rows = [];
  for (let o = start - (start % width); o < Math.min(end, b.length); o += width) {
    const bytes = Array.from(b.subarray(o, Math.min(o + width, b.length)));
    rows.push({ offset: o, bytes, ascii: bytes.map((x) => (printable(x) ? String.fromCharCode(x) : '.')).join('') });
  }
  return rows;
}
/** Classic `hexdump -C` layout: 8-digit offset, two 8-byte groups, |ASCII|, then the final length. */
export function dumpText(b, width = 16) {
  const half = width / 2,
    pad = width * 3 + (width > 8 ? 1 : 0);
  const out = dumpRows(b, width).map((r) => {
    let hex = '';
    r.bytes.forEach((x, i) => {
      hex += (i === half && width > 8 ? '  ' : ' ') + H[x];
    });
    return `${r.offset.toString(16).padStart(8, '0')} ${hex.padEnd(pad)}  |${r.ascii}|`;
  });
  out.push(b.length.toString(16).padStart(8, '0'));
  return out.join('\n');
}

/** All offsets where needle occurs (overlapping), capped. */
export function search(b, needle, cap = 10000) {
  const out = [];
  if (!needle.length || needle.length > b.length) return out;
  const first = needle[0];
  outer: for (let i = b.indexOf(first); i >= 0 && i <= b.length - needle.length; i = b.indexOf(first, i + 1)) {
    for (let j = 1; j < needle.length; j++) if (b[i + j] !== needle[j]) continue outer;
    out.push(i);
    if (out.length >= cap) break;
  }
  return out;
}

/** Interpret bytes at offset as numbers. Missing bytes give null. */
export function inspect(b, offset) {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const avail = b.length - offset;
  const types = [
    ['u8', 1, 'getUint8'],
    ['i8', 1, 'getInt8'],
    ['u16', 2, 'getUint16'],
    ['i16', 2, 'getInt16'],
    ['u32', 4, 'getUint32'],
    ['i32', 4, 'getInt32'],
    ['u64', 8, 'getBigUint64'],
    ['i64', 8, 'getBigInt64'],
    ['f32', 4, 'getFloat32'],
    ['f64', 8, 'getFloat64'],
  ];
  return types.map(([name, size, fn]) => {
    if (offset < 0 || avail < size) return { name, size, le: null, be: null };
    const v = (le) => {
      const x = view[fn](offset, le);
      return typeof x === 'number' && name[0] === 'f' ? fmtFloat(x) : String(x);
    };
    return { name, size, le: v(true), be: v(false) };
  });
}
const fmtFloat = (x) => (Number.isNaN(x) ? 'NaN' : !Number.isFinite(x) ? (x > 0 ? 'Infinity' : '-Infinity') : Object.is(x, -0) ? '-0' : String(x));
