import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { fail, gate, page, type AppEnv } from '../../auth.ts';
import { safeFetch } from '../../net.ts';
import type { Tool } from '../types.ts';
import { classify, summarize } from './logic.ts';

const app = new Hono<AppEnv>();
app.onError((e, c) => (e instanceof HTTPException ? c.json({ error: e.message }, e.status) : (console.error(e), c.json({ error: 'Internal error' }, 500))));
app.get('/', gate, (c) => page(c, 'rdap'));

app.get('/api/rdap', gate, async (c) => {
  const q = classify(c.req.query('q') ?? '');
  if (!q) return fail(400, 'Enter a domain name, an IPv4/IPv6 address or an AS number (e.g. AS13335)');
  const path = { domain: 'domain', ip: 'ip', asn: 'autnum' }[q.kind];
  // rdap.org redirects to the registry's RDAP server; safeFetch re-validates each hop.
  const get = () =>
    safeFetch(`https://rdap.org/${path}/${q.value}`, {
      headers: { accept: 'application/rdap+json, application/json', 'user-agent': 'Mozilla/5.0 (compatible; 6o2f-rdap)' },
    });
  const r = await get().catch(() => get()); // registries sometimes drop the first connection
  if (r.res.status === 404) return fail(404, `Not found: no RDAP record for ${q.value} (or its registry does not offer RDAP)`);
  if (!r.res.ok) return fail(400, `Registry error: HTTP ${r.res.status} from ${new URL(r.chain.at(-1)!.url).hostname}`);
  let raw: unknown;
  try {
    raw = JSON.parse(r.text);
  } catch {
    return fail(400, r.truncated ? 'Registry response too large' : 'Registry did not return JSON');
  }
  return c.json({ ...q, source: new URL(r.chain.at(-1)!.url).hostname, summary: summarize(q.kind, raw), raw });
});

export const tool: Tool = {
  name: 'rdap',
  title: 'Whois',
  blurb: 'Domain, IP and ASN lookup',
  icon: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M4 11h14"/><path d="M11 4c-2 2-2 12 0 14"/><path d="M11 4c2 2 2 12 0 14"/>',
  note: 'Needs sign-in. Queries public RDAP registries through rdap.org.',
  app,
};
