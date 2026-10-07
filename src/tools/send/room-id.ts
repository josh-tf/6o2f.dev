// Pure helpers: which Durable Object room a WebSocket belongs to. Kept free of Worker APIs so node can test them.
export const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

/** Network key: IPv4 as-is, IPv6 reduced to its /64 (first four hextets, normalised); 'dev' when there is no address. */
export function networkKey(ip: string | null | undefined): string {
  ip = ip?.trim().toLowerCase();
  if (!ip) return 'dev';
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return mapped[1];
  if (!ip.includes(':')) return ip;
  const [head, tail = ''] = ip.split('::');
  const a = head ? head.split(':') : [];
  const b = tail ? tail.split(':') : [];
  const groups = ip.includes('::') ? [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill('0'), ...b] : a;
  return groups
    .slice(0, 4)
    .map((g) => (parseInt(g, 16) || 0).toString(16))
    .join(':');
}

/** First 16 hex chars of SHA-256('nearby:' + network key + ':' + secret). The secret keeps room ids unguessable/unlinkable to IPs. */
export async function nearbyRoomId(ip: string | null | undefined, secret: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`nearby:${networkKey(ip)}:${secret}`));
  return [...new Uint8Array(d)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Room id for a request's query, or null when it is invalid. */
export async function roomId(q: { mode?: string | null; code?: string | null }, ip: string | null | undefined, secret: string): Promise<string | null> {
  if (q.code != null) return CODE_RE.test(q.code) ? `c:${q.code}` : null;
  return q.mode === 'nearby' ? nearbyRoomId(ip, secret) : null;
}
