import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { fail, gate, page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';
import { ALL_TYPES, TYPES, cleanName, diff, parseDoh, type Result } from './logic.ts';

const app = new Hono<AppEnv>();
app.onError((e, c) => (e instanceof HTTPException ? c.json({ error: e.message }, e.status) : (console.error(e), c.json({ error: 'Internal error' }, 500))));
app.get('/', gate, (c) => page(c, 'dns'));

const RESOLVERS = { cloudflare: 'https://cloudflare-dns.com/dns-query', google: 'https://dns.google/resolve' };

// Fixed hosts only: the user controls just the validated name/type query string. Failures come back as { error } so one slow resolver does not sink a multi-query view.
async function resolve(who: keyof typeof RESOLVERS, name: string, type: string): Promise<Result> {
  try {
    const r = await fetch(`${RESOLVERS[who]}?${new URLSearchParams({ name, type })}`, {
      headers: { accept: 'application/dns-json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return parseDoh(await r.json());
  } catch (e) {
    return {
      status: 'ERROR',
      ad: false,
      answers: [],
      error: `${who} ${e instanceof Error && e.name === 'TimeoutError' ? 'timed out' : 'failed'}${e instanceof Error && e.name !== 'TimeoutError' ? `: ${e.message}` : ''}`,
    };
  }
}
const nameOf = (q: string | undefined) => cleanName(q ?? '') ?? fail(400, 'Enter a valid domain name or IP address');
const typeOf = (q: string | undefined) => {
  const t = (q ?? 'A').toUpperCase();
  return TYPES.includes(t) ? t : fail(400, `Type must be one of ${TYPES.join(', ')}`);
};

app.get('/api/dns', gate, async (c) => {
  const name = nameOf(c.req.query('name')),
    type = typeOf(c.req.query('type'));
  return c.json({ name, type, ...(await resolve('cloudflare', name, type)) });
});

app.get('/api/dns/all', gate, async (c) => {
  const name = nameOf(c.req.query('name'));
  const rs = await Promise.all(ALL_TYPES.map((t) => resolve('cloudflare', name, t)));
  return c.json({ name, results: Object.fromEntries(ALL_TYPES.map((t, i) => [t, rs[i]])) });
});

app.get('/api/dns/compare', gate, async (c) => {
  const name = nameOf(c.req.query('name')),
    type = typeOf(c.req.query('type'));
  const [cloudflare, google] = await Promise.all([resolve('cloudflare', name, type), resolve('google', name, type)]);
  return c.json({ name, type, cloudflare, google, differences: cloudflare.error || google.error ? [] : diff(cloudflare, google) });
});

export const tool: Tool = {
  name: 'dns',
  title: 'DNS',
  blurb: 'Look up and compare records',
  icon: '<circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v4M12 11l-6 6M12 11l6 6"/>',
  note: 'Needs sign-in. Queries go to Cloudflare and Google public DNS over HTTPS.',
  app,
};
