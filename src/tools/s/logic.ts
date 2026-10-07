export const RESERVED = new Set(['api', '_', 'favicon.ico', 'robots.txt']);
export const SLUG = /^[A-Za-z0-9_-]{3,32}$/;
export const TTL: Record<string, number | undefined> = { '1d': 86400, '7d': 7 * 86400, '30d': 30 * 86400, never: undefined };

/** Returns the normalised target, or an error string. Only http(s), <=2048 chars, never our own domain (redirect loops). */
export function checkTarget(raw: unknown, domain: string): { url: string } | { error: string } {
  if (typeof raw !== 'string' || raw.length > 2048) return { error: 'url must be a string of at most 2048 characters' };
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { error: 'Invalid url' };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { error: 'Only http and https urls are allowed' };
  if (u.hostname === domain || u.hostname.endsWith(`.${domain}`)) return { error: 'Cannot shorten links to this domain' };
  return { url: u.href };
}

export const randomSlug = () => {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return [...a].map((b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
};
