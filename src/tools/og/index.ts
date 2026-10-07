import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { bodyLimit } from 'hono/body-limit';
import { fail, gate, page, type AppEnv } from '../../auth.ts';
import { checkUrl, safeFetch } from '../../net.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.onError((e, c) => (e instanceof HTTPException ? c.json({ error: e.message }, e.status) : (console.error(e), c.json({ error: 'Internal error' }, 500))));
app.get('/', gate, (c) => page(c, 'og'));

const abs = (v: string, base: string) => {
  try {
    return new URL(v, base).toString();
  } catch {
    return v;
  }
};
const URLISH = /(image|url|video|audio)$/;

app.post('/api/og', gate, bodyLimit({ maxSize: 4096, onError: (c) => c.json({ error: 'Request too large' }, 413) }), async (c) => {
  const { url } = await c.req.json<{ url?: string }>().catch(() => fail(400, 'Invalid JSON'));
  const r = await safeFetch(String(url ?? ''), {
    maxBytes: 256 * 1024,
    headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'Mozilla/5.0 (compatible; 6o2f-link-preview)' },
  });
  if (!/html/i.test(r.res.headers.get('content-type') ?? '')) fail(400, `Not an HTML page (${r.res.headers.get('content-type') ?? 'no content-type'})`);
  const final = r.chain[r.chain.length - 1].url;
  const out = {
    url: final,
    status: r.res.status,
    truncated: r.truncated,
    title: '',
    lang: '',
    canonical: '',
    description: '',
    themeColor: '',
    icons: [] as { rel: string; href: string; sizes: string }[],
    meta: [] as [string, string][],
  };
  let titleDone = false;
  await new HTMLRewriter()
    .on('html', {
      element: (e) => {
        out.lang ||= e.getAttribute('lang') ?? '';
      },
    })
    .on('title', {
      text: (t) => {
        if (!titleDone) {
          out.title += t.text;
          titleDone = titleDone || t.lastInTextNode;
        }
      },
    })
    .on('meta', {
      element: (e) => {
        const key = (e.getAttribute('property') || e.getAttribute('name') || e.getAttribute('itemprop') || '').trim().toLowerCase();
        const val = e.getAttribute('content');
        if (!key || val == null || out.meta.length >= 200) return;
        out.meta.push([key, URLISH.test(key) && !key.startsWith('twitter:site') ? abs(val, final) : val]);
      },
    })
    .on('link', {
      element: (e) => {
        const rel = (e.getAttribute('rel') ?? '').toLowerCase().split(/\s+/),
          href = e.getAttribute('href');
        if (!href) return;
        if (rel.includes('canonical')) out.canonical ||= abs(href, final);
        else if (rel.includes('icon') || rel.includes('apple-touch-icon'))
          out.icons.push({ rel: rel.join(' '), href: abs(href, final), sizes: e.getAttribute('sizes') ?? '' });
      },
    })
    .transform(new Response(r.text, { headers: { 'content-type': 'text/html' } }))
    .text();
  out.title = out.title.trim().replace(/\s+/g, ' ').slice(0, 300);
  const m = (k: string) => out.meta.find(([n]) => n === k)?.[1] ?? '';
  out.description = m('description');
  out.themeColor = m('theme-color');
  return c.json(out);
});

const IMG = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif']);
const MAX_IMG = 2 * 1024 * 1024;
// Binary proxy: safeFetch decodes bodies as text, so this repeats its redirect loop (checkUrl on every hop) and reads raw bytes.
app.get('/api/img', gate, async (c) => {
  let url = checkUrl(c.req.query('u') ?? '');
  for (let hop = 0; ; hop++) {
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
      headers: { accept: 'image/*', 'user-agent': 'Mozilla/5.0 (compatible; 6o2f-link-preview)' },
    }).catch(() => fail(400, 'Request failed'));
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) {
      if (hop >= 5) fail(400, 'Too many redirects');
      url = checkUrl(new URL(loc, url).toString());
      await res.body?.cancel();
      continue;
    }
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!res.ok || !IMG.has(type)) {
      await res.body?.cancel();
      return fail(400, IMG.has(type) ? `Upstream status ${res.status}` : 'Not a supported image type');
    }
    const chunks: Uint8Array[] = [];
    let n = 0;
    const reader = res.body!.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if ((n += value.byteLength) > MAX_IMG) {
        await reader.cancel();
        return fail(413, 'Image larger than 2 MB');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(n);
    let o = 0;
    for (const k of chunks) {
      bytes.set(k, o);
      o += k.length;
    }
    return new Response(bytes, {
      headers: { 'content-type': type, 'x-content-type-options': 'nosniff', 'content-security-policy': 'sandbox', 'cache-control': 'private, max-age=600' },
    });
  }
});

export const tool: Tool = {
  name: 'og',
  title: 'Link preview',
  blurb: 'See how a link unfurls',
  icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m3 15 5-4 4 3 3-2 6 4"/><circle cx="8.5" cy="8.5" r="1"/>',
  note: 'Needs sign-in. Fetches the page from our servers; private and internal addresses are refused.',
  app,
};
