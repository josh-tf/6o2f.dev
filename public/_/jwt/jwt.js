// Pure JWT helpers (no network, no DOM).
const bytes = (seg) => {
  const s = seg.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  if (/[^A-Za-z0-9+/]/.test(s) || s.length % 4 === 1) throw new Error('not valid base64url');
  return Uint8Array.from(atob(s + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
};
const json = (seg, what) => {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes(seg)));
  } catch (e) {
    throw new Error(`The ${what} is not valid base64url-encoded JSON (${e.message})`, { cause: e });
  }
};

/** Throws a readable Error on malformed input. */
export function decode(token) {
  const t = token
    .trim()
    .replace(/^bearer\s+/i, '')
    .replace(/\s+/g, ''); // tokens copied from logs often wrap
  if (!t) throw new Error('Paste a token');
  const p = t.split('.');
  if (p.length !== 3) throw new Error(`A JWT has 3 dot-separated parts; this has ${p.length}`);
  return { header: json(p[0], 'header'), payload: json(p[1], 'payload'), input: `${p[0]}.${p[1]}`, sig: p[2] };
}

/** "expired 2h ago" / "valid for 3h" etc. `kind` is exp | nbf | iat. */
export function status(kind, sec, now = Date.now() / 1000) {
  const d = Math.abs(sec - now);
  const n =
    d < 60
      ? `${Math.round(d)}s`
      : d < 3600
        ? `${Math.round(d / 60)}m`
        : d < 86400
          ? `${Math.round(d / 3600)}h`
          : d < 2 * 31557600
            ? `${Math.round(d / 86400)}d`
            : `${(d / 31557600).toFixed(1)}y`;
  const past = sec < now;
  if (kind === 'exp') return past ? { ok: false, text: `expired ${n} ago` } : { ok: true, text: `valid for ${n}` };
  if (kind === 'nbf') return past ? { ok: true, text: `active since ${n} ago` } : { ok: false, text: `not valid for another ${n}` };
  return { ok: true, text: past ? `issued ${n} ago` : `issued ${n} in the future` };
}

const secretBytes = (s) => {
  try {
    return bytes(s.trim());
  } catch {
    throw new Error('The secret is not valid Base64');
  }
};

/** HS256/384/512 check: true/false. Throws if alg is not an HS one. `b64` = the secret is Base64/Base64url-encoded bytes. */
export async function verifyHS(alg, input, sig, secret, b64 = false) {
  const hash = { HS256: 'SHA-256', HS384: 'SHA-384', HS512: 'SHA-512' }[alg];
  if (!hash) throw new Error(`${alg} is decoded but not verified here (only HS256, HS384, HS512)`);
  const key = await crypto.subtle.importKey('raw', b64 ? secretBytes(secret) : new TextEncoder().encode(secret), { name: 'HMAC', hash }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, bytes(sig), new TextEncoder().encode(input));
}
