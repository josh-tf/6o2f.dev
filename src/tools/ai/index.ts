import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { fail, gate, page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';
import { DAILY_CAP, DEFAULT_MODEL, LANGUAGES, MAX_INPUT, MAX_TOKENS, buildMessages, consume, fakeStream, refund, resetsAt, used, validate } from './logic.ts';

const app = new Hono<AppEnv>();
app.use('*', gate);
app.get('/', (c) => page(c, 'ai'));

const usage = (n: number, now: number) => ({ used: n, limit: DAILY_CAP, remaining: Math.max(0, DAILY_CAP - n), resetsAt: resetsAt(now) });
app.get('/api/usage', async (c) => {
  const now = Date.now();
  return c.json({ ...usage(await used(c.env.DB, c.get('user').id, now), now), maxInput: MAX_INPUT, languages: LANGUAGES });
});

// Streams the model's server-sent events straight through: data: {"response":"…"} … data: [DONE]
app.post('/api/run', bodyLimit({ maxSize: MAX_INPUT * 4 + 1024, onError: (c) => c.json({ error: 'Text is too long' }, 413) }), async (c) => {
  const r = validate(await c.req.json().catch(() => null));
  if (typeof r === 'string') return fail(400, r);
  const uid = c.get('user').id,
    now = Date.now();
  const left = await consume(c.env.DB, uid, now);
  if (left < 0) return fail(429, `Daily limit of ${DAILY_CAP} requests reached. It resets at 00:00 UTC.`);
  const messages = buildMessages(r, crypto.randomUUID().slice(0, 8));
  let stream: ReadableStream;
  try {
    if (c.env.DEV)
      stream = fakeStream(r); // wrangler dev --local cannot run Workers AI models
    else {
      const model = (c.env as Env & { AI_MODEL?: string }).AI_MODEL || DEFAULT_MODEL;
      const run = c.env.AI.run.bind(c.env.AI) as unknown as (m: string, i: object) => Promise<ReadableStream>;
      stream = await run(model, { messages, max_tokens: MAX_TOKENS, temperature: r.mode === 'grammar' || r.mode === 'translate' ? 0.2 : 0.6, stream: true });
    }
  } catch (e) {
    console.error('ai run failed', e);
    c.executionCtx.waitUntil(refund(c.env.DB, uid, now));
    return c.json({ error: 'The AI model is unavailable right now. Try again in a moment (this request was not counted).' }, 502);
  }
  return new Response(stream, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', 'x-ai-remaining': String(left) } });
});

export const tool: Tool = {
  name: 'ai',
  title: 'AI Helper',
  blurb: 'Rewrite, fix, summarise, translate',
  icon: '<path d="M9.5 3 11 7.5 15.5 9 11 10.5 9.5 15 8 10.5 3.5 9 8 7.5z"/><path d="M18 13l.8 2.2L21 16l-2.2.8L18 19l-.8-2.2L15 16l2.2-.8z"/><path d="M17 3v4"/><path d="M15 5h4"/>',
  note: `Needs sign-in. Text is sent to Cloudflare Workers AI and not stored by us; ${DAILY_CAP} requests per person per day.`,
  app,
};
