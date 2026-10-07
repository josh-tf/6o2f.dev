// JWT signing and verification with WebCrypto (RFC 7515/7518 compact serialization).
import { b64, b64url, unpem, pem } from '../keygen/lib.js';

export const ALGS = {
  HS256: { kind: 'hmac', hash: 'SHA-256', bytes: 32 },
  HS384: { kind: 'hmac', hash: 'SHA-384', bytes: 48 },
  HS512: { kind: 'hmac', hash: 'SHA-512', bytes: 64 },
  RS256: { kind: 'rsa', hash: 'SHA-256' },
  ES256: { kind: 'ec', hash: 'SHA-256', curve: 'P-256' },
};
const enc = new TextEncoder();
export const b64uJson = (o) => b64url(enc.encode(JSON.stringify(o)));
export const unb64u = (s) => {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('Not base64url.');
  const p = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(p + '='.repeat((4 - (p.length % 4)) % 4)), (c) => c.charCodeAt(0));
};

/** Parse a JSON object or throw a readable error naming the field. */
export function parseObject(text, what) {
  let v;
  try {
    v = JSON.parse(text);
  } catch (e) {
    throw new Error(`${what} is not valid JSON: ${e.message}`, { cause: e });
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`${what} must be a JSON object.`);
  return v;
}

/** HMAC secret bytes from text: UTF-8 by default, or base64/base64url. */
export function secretBytes(text, base64 = false) {
  if (!text) throw new Error('Enter a secret.');
  if (!base64) return enc.encode(text);
  const s = text.trim().replace(/\s+/g, '').replace(/=+$/, '');
  let b;
  try {
    b = unb64u(s.replace(/\+/g, '-').replace(/\//g, '_'));
  } catch {
    throw new Error('The secret is not valid base64.');
  }
  if (!b.length) throw new Error('Enter a secret.');
  return b;
}

/** Build { sign, verify, publicPem? } CryptoKeys for `alg` from a secret (HS*) or a PKCS#8 PEM (RS256/ES256). */
export async function importKeys(alg, material) {
  const a = ALGS[alg];
  if (!a) throw new Error(`Unsupported algorithm ${alg}.`);
  const S = crypto.subtle;
  if (a.kind === 'hmac') {
    const k = await S.importKey('raw', material, { name: 'HMAC', hash: a.hash }, false, ['sign', 'verify']);
    return { sign: k, verify: k };
  }
  let p;
  try {
    p = unpem(material);
  } catch {
    throw new Error('Paste a private key in PKCS#8 PEM form (-----BEGIN PRIVATE KEY-----).');
  }
  if (p.label === 'RSA PRIVATE KEY' || p.label === 'EC PRIVATE KEY')
    throw new Error(`This is a ${p.label.split(' ')[0]} key in the older format. Convert it: openssl pkcs8 -topk8 -nocrypt -in key.pem`);
  if (p.label === 'ENCRYPTED PRIVATE KEY') throw new Error('Encrypted keys are not supported. Decrypt it first: openssl pkcs8 -in key.pem');
  if (p.label !== 'PRIVATE KEY') throw new Error(`Expected a PRIVATE KEY PEM block, found ${p.label}.`);
  const params = a.kind === 'rsa' ? { name: 'RSASSA-PKCS1-v1_5', hash: a.hash } : { name: 'ECDSA', namedCurve: a.curve };
  let priv;
  try {
    priv = await S.importKey('pkcs8', p.der, params, true, ['sign']);
  } catch {
    throw new Error(a.kind === 'rsa' ? 'This is not an RSA private key, which RS256 needs.' : 'This is not a P-256 EC private key, which ES256 needs.');
  }
  const jwk = await S.exportKey('jwk', priv);
  for (const f of ['d', 'p', 'q', 'dp', 'dq', 'qi', 'key_ops']) delete jwk[f];
  const pub = await S.importKey('jwk', jwk, params, true, ['verify']);
  return { sign: priv, verify: pub, publicPem: pem(new Uint8Array(await S.exportKey('spki', pub)), 'PUBLIC KEY'), publicJwk: jwk };
}

const sigParams = (a) => (a.kind === 'hmac' ? 'HMAC' : a.kind === 'rsa' ? 'RSASSA-PKCS1-v1_5' : { name: 'ECDSA', hash: a.hash });

/** Compact JWS. ECDSA signatures from WebCrypto are already JOSE's raw r||s. */
export async function signJwt(alg, header, payload, keys) {
  const input = `${b64uJson(header)}.${b64uJson(payload)}`;
  const sig = new Uint8Array(await crypto.subtle.sign(sigParams(ALGS[alg]), keys.sign, enc.encode(input)));
  return `${input}.${b64url(sig)}`;
}
export async function verifyJwt(token, alg, keys) {
  const parts = String(token).split('.');
  if (parts.length !== 3) return false;
  let sig;
  try {
    sig = unb64u(parts[2]);
  } catch {
    return false;
  }
  return crypto.subtle.verify(sigParams(ALGS[alg]), keys.verify, sig, enc.encode(`${parts[0]}.${parts[1]}`));
}

/** Time-claim status at unix time `now`: 'valid' | 'expired' | 'notyet', plus a list of problems. */
export function timeStatus(payload, now) {
  const bad = [];
  for (const k of ['exp', 'nbf', 'iat'])
    if (k in payload && !Number.isFinite(payload[k])) bad.push(`${k} must be a number of seconds since 1970 (NumericDate).`);
  if (Number.isFinite(payload.exp) && payload.exp <= now) return { state: 'expired', bad };
  if (Number.isFinite(payload.nbf) && payload.nbf > now) return { state: 'notyet', bad };
  return { state: 'valid', bad };
}
/** "in 1 h 5 min" / "3 d ago" */
export function rel(sec) {
  if (Math.abs(sec) < 1) return 'now';
  const a = Math.abs(sec),
    u =
      a < 60
        ? `${Math.round(a)} s`
        : a < 3600
          ? `${Math.round(a / 60)} min`
          : a < 86400 * 2
            ? `${Math.round(a / 360) / 10} h`
            : `${Math.round(a / 8640) / 10} d`;
  return sec >= 0 ? `in ${u}` : `${u} ago`;
}
export const randomId = () => b64url(crypto.getRandomValues(new Uint8Array(16)));
export { b64 };
