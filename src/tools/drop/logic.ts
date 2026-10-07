export const MAX_BYTES = 100 * 1024 * 1024;
const TTL: Record<string, number> = { '1h': 3600e3, '1d': 86400e3, '7d': 7 * 86400e3, '30d': 30 * 86400e3 };
/** Own keys only: ?ttl=constructor must not resolve to an Object.prototype member. */
export const ttlMs = (t: string | undefined) => {
  const k = t ?? '1d';
  return Object.hasOwn(TTL, k) ? TTL[k] : undefined;
};
/** Strips path separators and control characters, caps at 100 chars. */
export const cleanName = (n: string | undefined) =>
  (n ?? '')
    .replace(/[\x00-\x1f\x7f/\\]/g, '')
    .trim()
    .slice(0, 100) || 'file';
/** RFC 5987 attachment header (encodeURIComponent leaves ' ( ) * unescaped). */
export const disposition = (name: string) =>
  `attachment; filename*=UTF-8''${encodeURIComponent(name).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())}`;
export const newId = () => {
  const b = new Uint8Array(18);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b))
    .replace(/\+/g, '-')
    .replace(/\//g, '_'); // 24 chars
};
