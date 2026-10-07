import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';
import { ipapi, safeHeaders } from './info.ts';

const app = new Hono<AppEnv>();
const ip = (c: { req: { header: (n: string) => string | undefined } }) => c.req.header('cf-connecting-ip');
const cfOf = (c: { req: { raw: Request } }) => c.req.raw.cf as Record<string, unknown> | undefined;
const open = { 'cache-control': 'no-store', 'access-control-allow-origin': '*' };

// Browsers (Accept: text/html) get the UI; everything else gets the bare IP.
app.get('/', (c) => (c.req.header('accept')?.includes('text/html') ? page(c, 'ip') : c.text(`${ip(c) || 'unknown'}\n`, 200, open)));

// ipapi.co/json-compatible, pretty-printed so `curl ip.6o2f.dev/json` reads well.
app.get('/json', (c) => c.body(JSON.stringify(ipapi(ip(c), cfOf(c)), null, 4) + '\n', 200, { ...open, 'content-type': 'application/json' }));

app.get('/headers', (c) =>
  c.text(
    Object.entries(safeHeaders(c.req.raw.headers))
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n') + '\n',
    200,
    open,
  ),
);

// ipapi.co style single fields: /country, /city/, /org, /timezone ...
app.get('/:field{[a-z_]+/?}', (c) => {
  const field = c.req.param('field').replace(/\/$/, '');
  const data = ipapi(ip(c), cfOf(c)) as Record<string, unknown>;
  if (!(field in data)) return c.text('Unknown field\n', 404, open);
  return c.text(`${data[field] ?? ''}\n`, 200, open);
});

export const tool: Tool = {
  name: 'ip',
  title: 'My IP',
  blurb: 'IP, location, ASN, country info',
  icon: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  note: 'Public. curl ip.6o2f.dev, /json, /country, /city, /org, /headers.',
  public: true,
  app,
};
