import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { fail, gate, page, type AppEnv } from '../../auth.ts';
import { checkUrl, safeFetch } from '../../net.ts';
import type { Tool } from '../types.ts';
import { grade, toMarkdown } from './grade.ts';

const app = new Hono<AppEnv>();
app.use('*', gate);
app.get('/', (c) => page(c, 'secheaders'));

const headerList = (h: Headers): [string, string][] => {
  const out: [string, string][] = [];
  h.forEach((v, k) => k !== 'set-cookie' && out.push([k, v]));
  for (const v of h.getSetCookie()) out.push(['set-cookie', v]);
  return out.sort((a, b) => a[0].localeCompare(b[0]));
};

app.post('/api/scan', bodyLimit({ maxSize: 4096, onError: (c) => c.json({ error: 'Request body too large' }, 413) }), async (c) => {
  const b = await c.req.json<{ url?: unknown }>().catch(() => ({ url: undefined }));
  const raw = typeof b.url === 'string' ? b.url.trim() : '';
  if (!raw) return fail(400, 'Enter a URL');
  const bare = !/^[a-z][a-z0-9+.-]*:/i.test(raw);
  let url = checkUrl(bare ? `https://${raw}` : raw);
  const httpUrl = new URL(url);
  httpUrl.protocol = 'http:';
  httpUrl.port = '';
  const get = (u: URL) =>
    safeFetch(u.toString(), {
      maxBytes: 256 * 1024,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; 6o2f-secheaders/1.0; +https://secheaders.6o2f.dev)', accept: 'text/html,*/*;q=0.8' },
    });
  const [main, plain] = await Promise.all([
    // A bare hostname is tried over https first; a site with no https at all is then graded over http (and fails HTTPS).
    get(url).catch((e) => (bare ? ((url = httpUrl), get(httpUrl)) : Promise.reject(e))),
    // http:// must answer with a redirect that ends up on https (http -> http://www -> https counts).
    safeFetch(httpUrl.toString(), { maxBytes: 1024, maxRedirects: 5 }).catch(() => null),
  ]);
  const finalUrl = main.chain[main.chain.length - 1].url;
  const first = plain?.chain[0];
  const httpRedirect = !plain ? null : first!.status >= 300 && first!.status < 400 ? plain.chain.some((h) => h.url.startsWith('https:')) : false;
  const headers = headerList(main.res.headers);
  const report = grade({ finalUrl, headers, httpRedirect });
  return c.json({
    url: url.toString(),
    finalUrl,
    status: main.res.status,
    chain: main.chain,
    ms: main.ms,
    headers,
    httpRedirect,
    ...report,
    markdown: toMarkdown(finalUrl, report),
  });
});

export const tool: Tool = {
  name: 'secheaders',
  title: 'Sec Headers',
  blurb: "Grade a site's security headers",
  icon: '<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/><path d="M8 9h8"/><path d="M8 13h5"/><path d="m14 15 1.5 1.5L18 14"/>',
  note: 'Needs sign-in. Fetches the URL from our server and grades its HTTP response headers (HSTS, CSP, cookies and more).',
  app,
};
