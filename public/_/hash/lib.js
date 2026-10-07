// MD5 (RFC 1321) plus WebCrypto digests/HMAC and output encodings. All inputs are Uint8Array.
const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);

export function md5(data) {
  const len = data.length,
    n = ((len + 8) >> 6) + 1,
    buf = new Uint8Array(n * 64),
    v = new DataView(buf.buffer);
  buf.set(data);
  buf[len] = 0x80;
  v.setUint32(n * 64 - 8, (len << 3) >>> 0, true);
  v.setUint32(n * 64 - 4, Math.floor(len / 2 ** 29), true);
  let a0 = 0x67452301,
    b0 = 0xefcdab89,
    c0 = 0x98badcfe,
    d0 = 0x10325476;
  for (let o = 0; o < buf.length; o += 64) {
    let a = a0,
      b = b0,
      c = c0,
      d = d0;
    for (let i = 0; i < 64; i++) {
      let f, g;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) & 15;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) & 15;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) & 15;
      }
      f = (f + a + K[i] + v.getUint32(o + g * 4, true)) | 0;
      a = d;
      d = c;
      c = b;
      const s = S[(i >> 4) * 4 + (i & 3)];
      b = (b + ((f << s) | (f >>> (32 - s)))) | 0;
    }
    a0 = (a0 + a) | 0;
    b0 = (b0 + b) | 0;
    c0 = (c0 + c) | 0;
    d0 = (d0 + d) | 0;
  }
  const out = new Uint8Array(16),
    ov = new DataView(out.buffer);
  [a0, b0, c0, d0].forEach((x, i) => ov.setUint32(i * 4, x, true));
  return out;
}

export const ALGS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];
export const MAX_BYTES = 200 * 1024 * 1024;

export async function digest(alg, data) {
  return alg === 'MD5' ? md5(data) : new Uint8Array(await crypto.subtle.digest(alg, data));
}

export async function hmac(alg, key, data) {
  if (alg !== 'MD5') {
    const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: alg }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
  }
  // WebCrypto has no MD5, so build HMAC by hand: H((K^opad) || H((K^ipad) || m)), block size 64.
  let k = key.length > 64 ? md5(key) : key;
  const pad = (x) => Uint8Array.from({ length: 64 }, (_, i) => (k[i] ?? 0) ^ x);
  const cat = (a, b) => {
    const r = new Uint8Array(a.length + b.length);
    r.set(a);
    r.set(b, a.length);
    return r;
  };
  return md5(cat(pad(0x5c), md5(cat(pad(0x36), data))));
}

export const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
export const b64 = (b) => btoa(String.fromCharCode(...b));
export const b64url = (b) => b64(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const FORMATS = { hex, base64: b64, base64url: b64url };

/** Does `expected` (whitespace ignored, hex case-insensitive) equal the digest in any supported encoding? */
export function matches(bytes, expected) {
  const e = expected.replace(/\s+/g, '');
  return !!e && (e.toLowerCase() === hex(bytes) || e === b64(bytes) || e.replace(/=+$/, '') === b64(bytes).replace(/=+$/, '') || e === b64url(bytes));
}
