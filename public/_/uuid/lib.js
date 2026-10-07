import { randBytes } from '../random/lib.js';

const H = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const dashed = (h) => `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
const ms48 = (ms) => ms.toString(16).padStart(12, '0');

export const NIL = '00000000-0000-0000-0000-000000000000';
export const v4 = () => crypto.randomUUID();

/** UUIDv7 (RFC 9562): 48-bit unix ms, version 7, 74 random bits, variant 10. */
export function v7(ms = Date.now(), rnd = randBytes(10)) {
  const r = Uint8Array.from(rnd);
  r[0] = 0x70 | (r[0] & 0x0f); // version nibble + 4 random bits
  r[2] = 0x80 | (r[2] & 0x3f); // variant 10 + 6 random bits
  return dashed(ms48(ms) + H(r));
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
/** ULID: 48-bit unix ms + 80 random bits, 26 Crockford base32 chars. */
export function ulid(ms = Date.now(), rnd = randBytes(10)) {
  let n = (BigInt(ms) << 80n) | BigInt('0x' + H(rnd)),
    s = '';
  for (let i = 0; i < 26; i++, n >>= 5n) s = CROCKFORD[Number(n & 31n)] + s;
  return s;
}

/** `n` ids of `kind` (v4|v7|ulid|nil). Time-based kinds are sorted so a bulk list is ordered even inside one millisecond. */
export function make(kind, n) {
  // ponytail: sort instead of a monotonic counter; add one if ids from separate calls must order
  const g = { v4, v7: () => v7(), ulid: () => ulid(), nil: () => NIL }[kind];
  const out = Array.from({ length: n }, g);
  return kind === 'v7' || kind === 'ulid' ? out.sort() : out;
}

export const format = (id, { upper, hyphens = true, braces } = {}) => {
  if (id.length === 26) return id; // ULIDs are canonical uppercase Crockford
  if (!hyphens) id = id.replace(/-/g, '');
  if (upper) id = id.toUpperCase();
  return braces ? `{${id}}` : id;
};

/** Decode an embedded 48-bit unix-ms timestamp from a ULID. */
const ulidMs = (s) => Number([...s.toUpperCase()].slice(0, 10).reduce((n, c) => n * 32n + BigInt(CROCKFORD.indexOf(c)), 0n));

/** Parse a UUID (hyphens, braces, urn:uuid: optional) or ULID. Returns {error} or details. */
export function parse(input) {
  const s = input
    .trim()
    .replace(/^urn:uuid:/i, '')
    .replace(/^\{(.*)\}$/, '$1');
  if (/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i.test(s)) return { kind: 'ULID', ms: ulidMs(s) };
  const h = s.replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(h) || (s.includes('-') && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)))
    return { error: 'Not a UUID: expected 32 hex digits, as 8-4-4-4-12 with hyphens or without.' };
  if (/^0+$/.test(h)) return { kind: 'UUID', version: 'nil', variant: 'Nil UUID (all zero)' };
  if (/^f+$/.test(h)) return { kind: 'UUID', version: 'max', variant: 'Max UUID (all one)' };
  const version = parseInt(h[12], 16),
    v = parseInt(h[16], 16);
  const variant = v < 8 ? 'NCS (reserved, backward compatible)' : v < 12 ? 'RFC 4122 / 9562' : v < 14 ? 'Microsoft (reserved)' : 'Reserved (future)';
  const r = { kind: 'UUID', version, variant };
  if (version === 7) r.ms = parseInt(h.slice(0, 12), 16);
  if (version === 6) r.ms = Number((BigInt('0x' + h.slice(0, 12) + h.slice(13, 16)) - 0x01b21dd213814000n) / 10000n); // v1 fields reordered
  if (version === 1) {
    // 60-bit count of 100 ns ticks since 1582-10-15
    const t = BigInt('0x' + h.slice(13, 16) + h.slice(8, 12) + h.slice(0, 8));
    r.ms = Number((t - 0x01b21dd213814000n) / 10000n);
  }
  return r;
}
