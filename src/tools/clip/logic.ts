export const MAX_BYTES = 64 * 1024;
export const TTLS: Record<string, number> = { '10m': 600, '1h': 3600, '1d': 86400 };
export const ID_RE = /^\d{13}-[a-z0-9]{6}$/;
const FAR = 9_999_999_999_999;

/** Ids sort newest first under KV's lexicographic list order. */
export const newId = (now = Date.now()) => `${String(FAR - now).padStart(13, '0')}-${crypto.randomUUID().replace(/-/g, '').slice(0, 6)}`;
export const byteLength = (s: string) => new TextEncoder().encode(s).length;
export const ttlSeconds = (t: unknown) => {
  const k = String(t ?? '1h');
  return Object.hasOwn(TTLS, k) ? TTLS[k] : undefined;
};
