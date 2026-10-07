export const TTLS: Record<string, number> = { '1h': 3600, '1d': 86400, '7d': 604800, '30d': 2592000 };
export const MAX_BYTES = 512 * 1024;
export const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

/** Seconds for a ?ttl= value; undefined = default (1d); null = invalid. */
export const ttlSeconds = (q: string | undefined) => (q === undefined || q === '' ? TTLS['1d'] : Object.hasOwn(TTLS, q) ? TTLS[q] : null);

/** 16 unguessable url-safe chars (96 bits). */
export const newId = () =>
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(12))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
