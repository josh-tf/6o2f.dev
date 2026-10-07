// Pure helpers for key export: PEM wrapping, a minimal SPKI reader and OpenSSH public key encoding.
export const b64 = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
export const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const b64url = (bytes) => b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const concat = (...a) => {
  const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0));
  let p = 0;
  for (const x of a) {
    o.set(x, p);
    p += x.length;
  }
  return o;
};

/** Wrap DER bytes as PEM (64-column lines, LF). */
export const pem = (der, label) =>
  `-----BEGIN ${label}-----\n${b64(der)
    .match(/.{1,64}/g)
    .join('\n')}\n-----END ${label}-----\n`;
/** DER bytes from a PEM string (first block). */
export function unpem(text) {
  const m = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/.exec(text);
  if (!m) throw new Error('No PEM block found.');
  return { label: m[1], der: unb64(m[2].replace(/\s+/g, '')) };
}

/** Read one DER TLV at `off`. Returns { tag, start, end, next } (content = [start, end)). */
export function tlv(b, off = 0) {
  const tag = b[off];
  let len = b[off + 1],
    p = off + 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (!n || n > 4) throw new Error('Bad DER length.');
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + b[p++];
  }
  if (p + len > b.length) throw new Error('Truncated DER.');
  return { tag, start: p, end: p + len, next: p + len };
}
const oidStr = (b) => {
  const o = [];
  let v = 0;
  for (let i = 0; i < b.length; i++) {
    v = v * 128 + (b[i] & 127);
    if (!(b[i] & 128)) {
      if (!o.length) o.push(Math.min(Math.floor(v / 40), 2), v - 40 * Math.min(Math.floor(v / 40), 2));
      else o.push(v);
      v = 0;
    }
  }
  return o.join('.');
};
const CURVES = { '1.2.840.10045.3.1.7': ['nistp256', 'P-256'], '1.3.132.0.34': ['nistp384', 'P-384'], '1.3.132.0.35': ['nistp521', 'P-521'] };

/** Parse an SPKI DER into { type: 'rsa'|'ec'|'ed25519', n, e } | { curve, point } | { key }. */
export function parseSpki(der) {
  const seq = tlv(der, 0);
  if (seq.tag !== 0x30) throw new Error('Not an SPKI structure.');
  const alg = tlv(der, seq.start),
    oid = tlv(der, alg.start);
  const algOid = oidStr(der.subarray(oid.start, oid.end));
  const bs = tlv(der, alg.next);
  if (bs.tag !== 0x03) throw new Error('Not an SPKI structure.');
  const bits = der.subarray(bs.start + 1, bs.end);
  if (algOid === '1.2.840.113549.1.1.1' || algOid === '1.2.840.113549.1.1.10') {
    const s = tlv(bits, 0),
      n = tlv(bits, s.start),
      e = tlv(bits, n.next);
    return { type: 'rsa', n: bits.subarray(n.start, n.end), e: bits.subarray(e.start, e.end) };
  }
  if (algOid === '1.2.840.10045.2.1') {
    const c = tlv(der, oid.next),
      curve = oidStr(der.subarray(c.start, c.end));
    if (!CURVES[curve]) throw new Error(`Unsupported curve ${curve}.`);
    return { type: 'ec', curve: CURVES[curve][0], point: bits };
  }
  if (algOid === '1.3.101.112') return { type: 'ed25519', key: bits };
  throw new Error(`Unsupported key algorithm ${algOid}.`);
}

const u32 = (n) => new Uint8Array([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const str = (b) => concat(u32(b.length), b);
const txt = (s) => str(new TextEncoder().encode(s));
const mpint = (b) => {
  let i = 0;
  while (i < b.length - 1 && b[i] === 0) i++;
  b = b.subarray(i);
  return str(b[0] & 128 ? concat(new Uint8Array([0]), b) : b);
};

/** OpenSSH public key blob for an SPKI DER key. */
export function sshBlob(spkiDer) {
  const k = parseSpki(spkiDer);
  if (k.type === 'rsa') return concat(txt('ssh-rsa'), mpint(k.e), mpint(k.n));
  if (k.type === 'ec') return concat(txt(`ecdsa-sha2-${k.curve}`), txt(k.curve), str(k.point));
  return concat(txt('ssh-ed25519'), str(k.key));
}
const blobName = (blob) => new TextDecoder().decode(blob.subarray(4, 4 + new DataView(blob.buffer, blob.byteOffset).getUint32(0)));
/** `ssh-ed25519 AAAA... comment` line. */
export function sshPublicLine(spkiDer, comment = '') {
  const b = sshBlob(spkiDer);
  return `${blobName(b)} ${b64(b)}${comment ? ' ' + comment : ''}`;
}
/** `SHA256:...` fingerprint as printed by `ssh-keygen -l`. */
export async function sshFingerprint(spkiDer) {
  return 'SHA256:' + b64(new Uint8Array(await crypto.subtle.digest('SHA-256', sshBlob(spkiDer)))).replace(/=+$/, '');
}

/** Bit length of an RSA modulus, for display. */
export const rsaBits = (n) => {
  let i = 0;
  while (n[i] === 0) i++;
  return (n.length - i) * 8 - Math.clz32(n[i]) + 24;
};
