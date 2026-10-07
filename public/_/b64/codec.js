// Pure Base64 helpers, UTF-8 correct (btoa/atob alone only handle Latin-1).
export function encodeBytes(bytes, { url = false, pad = true } = {}) {
  let bin = '';
  // chunked: spreading a huge array into fromCharCode overflows the call stack
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  let s = btoa(bin);
  if (url) s = s.replace(/\+/g, '-').replace(/\//g, '_');
  return pad ? s : s.replace(/=+$/, '');
}
export const encode = (text, opts) => encodeBytes(new TextEncoder().encode(text), opts);

/** Accepts standard or URL-safe, padded or not, ignoring whitespace. Throws a readable Error. */
export function decodeBytes(b64) {
  const s = b64.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const bad = s.match(/[^A-Za-z0-9+/]/);
  if (bad) throw new Error(`Not valid Base64: unexpected character ${JSON.stringify(bad[0])} at position ${bad.index + 1}`);
  if (s.length % 4 === 1) throw new Error('Not valid Base64: length is impossible (a stray character at the end)');
  return Uint8Array.from(atob(s + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
}
export function decode(b64) {
  const b = decodeBytes(b64);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(b);
  } catch {
    throw new Error(`Decoded ${b.length} ${b.length === 1 ? 'byte is' : 'bytes are'} not valid UTF-8 text`);
  }
}
/** "de ad be ef" with a line break every 16 bytes. */
export const hex = (bytes) =>
  Array.from(bytes, (x, i) => x.toString(16).padStart(2, '0') + (i % 16 === 15 ? '\n' : ' '))
    .join('')
    .trimEnd();
