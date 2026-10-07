// Outbound fetch for tools that retrieve user-supplied URLs (http, og, rss, rdap, uptime). Always use this, never bare fetch().
import { fail } from './auth.ts';

const PRIVATE_V4 = /^(0\.|10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|22[4-9]\.|2[3-5]\d\.)/;

/** Validates a user-supplied URL: http(s) only, no credentials, no localhost / internal names / private or literal-IP hosts, standard ports. */
export function checkUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return fail(400, 'Not a valid URL');
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') fail(400, 'Only http and https URLs are allowed');
  if (u.username || u.password) fail(400, 'URLs with credentials are not allowed');
  if (u.port && !['80', '443', '8080', '8443'].includes(u.port)) fail(400, 'Port not allowed');
  const h = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!h.includes('.') || h === 'localhost' || /\.(local|localhost|internal|lan|home|corp|test|invalid|ts\.net|arpa|svc)$/.test(h))
    fail(400, 'Host not allowed');
  if (h.startsWith('[') || /^\d+$/.test(h.split('.').pop() ?? '') || PRIVATE_V4.test(h)) fail(400, 'IP addresses are not allowed; use a hostname');
  // ponytail: literal names only (no DNS resolution). Cloudflare egress cannot reach private/tailnet addresses, so that is the real boundary in production.
  return u;
}

/** Request headers without authorization, proxy-authorization and cookie (for a cross-origin redirect hop). */
export function stripCredentials(h: HeadersInit | undefined): Headers {
  const out = new Headers(h);
  for (const k of ['authorization', 'proxy-authorization', 'cookie']) out.delete(k);
  return out;
}

export type Fetched = { res: Response; text: string; truncated: boolean; ms: number; chain: { url: string; status: number }[] };

/** GET/HEAD/etc. with manual redirect handling (each hop re-validated), 8 s timeout and a body cap (default 512 KB, read as text). */
export async function safeFetch(raw: string, init: RequestInit & { maxBytes?: number; maxRedirects?: number } = {}): Promise<Fetched> {
  const { maxBytes = 512 * 1024, maxRedirects = 5, ...rest } = init;
  const chain: Fetched['chain'] = [];
  let url = checkUrl(raw),
    method = rest.method ?? 'GET',
    body = rest.body;
  const t0 = Date.now();
  for (let hop = 0; ; hop++) {
    const res = await fetch(url, { ...rest, method, body, redirect: 'manual', signal: AbortSignal.timeout(8000) }).catch((e) =>
      fail(400, `Request failed: ${e instanceof Error ? e.message : 'error'}`),
    );
    chain.push({ url: url.toString(), status: res.status });
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) {
      if (hop >= maxRedirects) fail(400, 'Too many redirects');
      const next = checkUrl(new URL(loc, url).toString());
      if (next.origin !== url.origin) rest.headers = stripCredentials(rest.headers); // never forward the user's credentials to another origin
      url = next;
      if (res.status === 303 || ((res.status === 301 || res.status === 302) && method === 'POST')) {
        method = 'GET';
        body = undefined;
      }
      await res.body?.cancel();
      continue;
    }
    let text = '',
      truncated = false;
    if (res.body && method !== 'HEAD') {
      const reader = res.body.getReader(),
        dec = new TextDecoder();
      let n = 0;
      for (;;) {
        const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined })); // a server that drops the connection mid-body (e.g. Verisign RDAP 404) keeps what arrived
        if (done) break;
        n += value!.byteLength;
        if (n > maxBytes) {
          truncated = true;
          await reader.cancel();
          break;
        }
        text += dec.decode(value!, { stream: true });
      }
    }
    return { res, text, truncated, ms: Date.now() - t0, chain };
  }
}
