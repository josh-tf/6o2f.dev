export const MAX_BODY = 256 * 1024;

/** Reads at most MAX_BODY bytes of a stream; `truncated` is true if more was sent. */
export async function readCapped(body: ReadableStream<Uint8Array> | null) {
  const out = new Uint8Array(MAX_BODY);
  let n = 0,
    truncated = false;
  if (body) {
    const r = body.getReader();
    for (;;) {
      const { done, value } = await r.read();
      if (done) break;
      const take = Math.min(value.length, MAX_BODY - n);
      out.set(value.subarray(0, take), n);
      n += take;
      if (take < value.length) {
        truncated = true;
        r.cancel().catch(() => {});
        break;
      }
    }
  }
  return { bytes: out.subarray(0, n), truncated };
}

/** Text if valid UTF-8, else base64. */
export function encodeBody(bytes: Uint8Array): { body: string; encoding: 'text' | 'base64' } {
  try {
    return { body: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes), encoding: 'text' };
  } catch {
    let s = '';
    for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return { body: btoa(s), encoding: 'base64' };
  }
}

/** Headers as a plain object, minus cookies (our session cookie is shared across *.DOMAIN). */
export const safeHeaders = (h: Headers) => Object.fromEntries([...h].filter(([k]) => k !== 'cookie'));
