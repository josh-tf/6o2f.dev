// Pure TOTP/HOTP logic (RFC 4226, RFC 6238). Uses WebCrypto HMAC; nothing leaves the page.
const A32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const ALGS = { 'SHA-1': 'SHA1', 'SHA-256': 'SHA256', 'SHA-512': 'SHA512' };

/** Base32 (RFC 4648) to bytes. Ignores spaces, hyphens, padding and case. Throws on other characters. */
export function b32decode(s) {
  const clean = String(s).toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '');
  if (!clean) throw new Error('Enter a secret.');
  let bits = 0,
    val = 0;
  const out = [];
  for (const ch of clean) {
    const i = A32.indexOf(ch);
    if (i < 0) throw new Error(`"${ch}" is not valid base32 (use A-Z and 2-7).`);
    val = (val << 5) | i;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((val >> bits) & 255);
    }
  }
  if (!out.length) throw new Error('Secret is too short.');
  return new Uint8Array(out);
}
export function b32encode(bytes) {
  let bits = 0,
    val = 0,
    out = '';
  for (const b of bytes) {
    val = (val << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += A32[(val >> bits) & 31];
    }
  }
  if (bits) out += A32[(val << (5 - bits)) & 31];
  return out;
}
export const randomSecret = (n = 20) => b32encode(crypto.getRandomValues(new Uint8Array(n)));

/** HOTP: counter is a non-negative integer (number or bigint). */
export async function hotp(secret, counter, { digits = 6, algorithm = 'SHA-1' } = {}) {
  const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: algorithm }, false, ['sign']);
  const msg = new DataView(new ArrayBuffer(8));
  msg.setBigUint64(0, BigInt(counter));
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
  const o = h[h.length - 1] & 15;
  const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}
/** TOTP at unix time `t` (seconds). */
export const totp = (secret, t, { period = 30, ...o } = {}) => hotp(secret, Math.floor(t / period), o);
export const secondsLeft = (t, period = 30) => period - (Math.floor(t) % period);

/** Parse otpauth://totp/Issuer:account?secret=...&issuer=...&algorithm=SHA1&digits=6&period=30 (or hotp with counter). */
export function parseOtpauth(uri) {
  let u;
  try {
    u = new URL(String(uri).trim());
  } catch {
    throw new Error('Not a valid URI.');
  }
  if (u.protocol !== 'otpauth:') throw new Error('The URI must start with otpauth://');
  const type = u.hostname.toLowerCase();
  if (type !== 'totp' && type !== 'hotp') throw new Error('The type must be totp or hotp.');
  const p = u.searchParams;
  let label = u.pathname.replace(/^\//, '');
  try {
    label = decodeURIComponent(label);
  } catch {}
  let issuer = p.get('issuer') || '';
  const i = label.indexOf(':');
  if (i >= 0) {
    if (!issuer) issuer = label.slice(0, i).trim();
    label = label.slice(i + 1).trim();
  }
  const secret = p.get('secret');
  if (!secret) throw new Error('The URI has no secret parameter.');
  const alg = (p.get('algorithm') || 'SHA1').toUpperCase().replace(/^SHA-?/, 'SHA-');
  if (!(alg in ALGS)) throw new Error(`Unsupported algorithm ${p.get('algorithm')}.`);
  const digits = Number(p.get('digits') || 6),
    period = Number(p.get('period') || 30),
    counter = Number(p.get('counter') || 0);
  if (![6, 7, 8].includes(digits)) throw new Error('Digits must be 6, 7 or 8.');
  if (!(period >= 1)) throw new Error('Invalid period.');
  return { type, label, issuer, secret: secret.replace(/\s/g, '').toUpperCase(), algorithm: alg, digits, period, counter };
}
export function buildOtpauth({ type = 'totp', label = '', issuer = '', secret, algorithm = 'SHA-1', digits = 6, period = 30, counter = 0 }) {
  const enc = encodeURIComponent;
  const path = (issuer ? `${enc(issuer)}:` : '') + enc(label);
  const q = [`secret=${secret.replace(/[\s=-]/g, '').toUpperCase()}`];
  if (issuer) q.push(`issuer=${enc(issuer)}`);
  q.push(`algorithm=${ALGS[algorithm]}`, `digits=${digits}`);
  q.push(type === 'hotp' ? `counter=${counter}` : `period=${period}`);
  return `otpauth://${type}/${path}?${q.join('&')}`;
}
/** Group a code for reading: 123456 -> 123 456. */
export const group = (c) => (c.length === 8 ? c.replace(/(.{4})/, '$1 ') : c.replace(/(.{3})/, '$1 '));
