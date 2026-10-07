import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { getCookie, setCookie } from 'hono/cookie';
import { fail, gate, page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';
import { MAX_POLLS, canSeeResults, isOpen, makeLimiter, newId, tally, validateChoices, validateCreate, voterHash } from './logic.ts';

// Management (/ and /api/polls*) is behind the gate. Voting (/p/<id>, /api/poll/<id>*) is public by design: one vote per voter hash + cookie.
const app = new Hono<AppEnv>();
app.get('/', gate, (c) => page(c, 'vote'));
app.use('/api/polls', gate);
app.use('/api/polls/*', gate);

type Poll = { id: string; user_id: string; question: string; options: string; multi: number; show_results: number; created_at: number; closes_at: number };
const ID = '{[a-z2-9]{8}}';
const limited = makeLimiter(30, 60_000); // keyed by IP: the voter hash includes the user agent, which a client can rotate freely

async function results(db: D1Database, p: Poll) {
  const options = JSON.parse(p.options) as string[];
  const { results: rows } = await db
    .prepare('SELECT j.value AS i, COUNT(*) AS n FROM vote_votes v, json_each(v.choices) j WHERE v.poll_id = ? GROUP BY j.value')
    .bind(p.id)
    .all<{ i: number; n: number }>();
  const voters = (await db.prepare('SELECT COUNT(*) AS n FROM vote_votes WHERE poll_id = ?').bind(p.id).first<{ n: number }>())?.n ?? 0;
  return tally(options.length, rows, voters);
}
const view = (p: Poll, now: number) => ({
  id: p.id,
  question: p.question,
  options: JSON.parse(p.options) as string[],
  multi: !!p.multi,
  showResults: !!p.show_results,
  createdAt: p.created_at,
  closesAt: p.closes_at,
  open: isOpen(p, now),
});

// ---- manage (gated) ----
app.get('/api/polls', async (c) => {
  const { results: rows } = await c.env.DB.prepare('SELECT * FROM vote_polls WHERE user_id = ? ORDER BY created_at DESC').bind(c.get('user').id).all<Poll>();
  const now = Date.now();
  return c.json(await Promise.all(rows.map(async (p) => ({ ...view(p, now), results: await results(c.env.DB, p) }))));
});
app.post('/api/polls', bodyLimit({ maxSize: 8 * 1024, onError: (c) => c.json({ error: 'Request body too large' }, 413) }), async (c) => {
  const now = Date.now(),
    uid = c.get('user').id;
  const v = validateCreate(await c.req.json().catch(() => null), now);
  if (typeof v === 'string') return fail(400, v);
  const have = (await c.env.DB.prepare('SELECT COUNT(*) AS n FROM vote_polls WHERE user_id = ?').bind(uid).first<{ n: number }>())?.n ?? 0;
  if (have >= MAX_POLLS) return fail(409, `Limit of ${MAX_POLLS} polls reached. Delete one first.`);
  const id = newId();
  await c.env.DB.prepare('INSERT INTO vote_polls (id, user_id, question, options, multi, show_results, created_at, closes_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, uid, v.question, JSON.stringify(v.options), v.multi ? 1 : 0, v.showResults ? 1 : 0, now, v.closesAt)
    .run();
  return c.json({ id }, 201);
});
const mine = async (c: { env: Env; get: (k: 'user') => { id: string }; req: { param: (k: string) => string } }) =>
  (await c.env.DB.prepare('SELECT * FROM vote_polls WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).first<Poll>()) ??
  fail(404, 'Poll not found');
app.get(`/api/polls/:id${ID}/results`, async (c) => {
  const p = await mine(c);
  return c.json({ ...view(p, Date.now()), results: await results(c.env.DB, p) });
});
app.post(`/api/polls/:id${ID}/close`, async (c) => {
  const p = await mine(c);
  if (isOpen(p, Date.now())) await c.env.DB.prepare('UPDATE vote_polls SET closes_at = ? WHERE id = ?').bind(Date.now(), p.id).run();
  return c.body(null, 204);
});
app.delete(`/api/polls/:id${ID}`, async (c) => {
  const p = await mine(c);
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM vote_votes WHERE poll_id = ?').bind(p.id),
    c.env.DB.prepare('DELETE FROM vote_polls WHERE id = ?').bind(p.id),
  ]);
  return c.body(null, 204);
});

// ---- public voting ----
const voterOf = (c: { env: Env; req: { header: (k: string) => string | undefined } }, id: string) =>
  voterHash(c.env.SESSION_SECRET, id, c.req.header('cf-connecting-ip') ?? '', c.req.header('user-agent') ?? '');
const cookieName = (id: string) => `v_${id}`;

app.get(`/p/:id${ID}`, async (c) => {
  const res = await c.env.ASSETS.fetch(new Request(new URL('/_/vote/poll', c.req.url)));
  return new Response(res.body, {
    status: res.status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex', 'cache-control': 'no-store' },
  });
});
app.get(`/api/poll/:id${ID}`, async (c) => {
  const id = c.req.param('id'),
    now = Date.now();
  const p = await c.env.DB.prepare('SELECT * FROM vote_polls WHERE id = ?').bind(id).first<Poll>();
  if (!p) return fail(404, 'Poll not found');
  const voted =
    !!getCookie(c, cookieName(id)) ||
    !!(await c.env.DB.prepare('SELECT 1 AS x FROM vote_votes WHERE poll_id = ? AND voter = ?')
      .bind(id, await voterOf(c, id))
      .first());
  const { id: _i, createdAt: _c, showResults: _s, ...pub } = view(p, now);
  return c.json({ id, ...pub, voted, results: canSeeResults(p, now) ? await results(c.env.DB, p) : null }, 200, { 'x-robots-tag': 'noindex' });
});
app.post(`/api/poll/:id${ID}/vote`, bodyLimit({ maxSize: 1024, onError: (c) => c.json({ error: 'Request body too large' }, 413) }), async (c) => {
  const id = c.req.param('id'),
    now = Date.now();
  const p = await c.env.DB.prepare('SELECT * FROM vote_polls WHERE id = ?').bind(id).first<Poll>();
  if (!p) return fail(404, 'Poll not found');
  if (!isOpen(p, now)) return fail(409, 'This poll is closed');
  const voter = await voterOf(c, id);
  if (!limited(c.req.header('cf-connecting-ip') ?? voter, now)) return fail(429, 'Too many attempts. Wait a minute.');
  if (getCookie(c, cookieName(id))) return fail(409, 'You have already voted');
  const options = JSON.parse(p.options) as string[];
  const choices = validateChoices((await c.req.json<{ choices?: unknown }>().catch(() => ({ choices: undefined }))).choices, options.length, !!p.multi);
  if (typeof choices === 'string') return fail(400, choices);
  const r = await c.env.DB.prepare('INSERT INTO vote_votes (poll_id, voter, choices, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING')
    .bind(id, voter, JSON.stringify(choices), now)
    .run();
  if (!r.meta.changes) return fail(409, 'You have already voted');
  setCookie(c, cookieName(id), '1', { path: '/', httpOnly: true, secure: true, sameSite: 'Lax', maxAge: Math.max(60, Math.ceil((p.closes_at - now) / 1000)) });
  return c.json({ ok: true, results: canSeeResults(p, now) ? await results(c.env.DB, p) : null }, 201);
});

export const tool: Tool = {
  name: 'vote',
  title: 'Polls',
  blurb: 'Quick polls with a share link',
  icon: '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx=".5"/><rect x="12" y="7" width="3" height="11" rx=".5"/><path d="m17 9 1.5 1.5L21 7"/>',
  note: 'Creating and managing polls needs sign-in. Anyone with a poll link can vote without signing in (one vote per person).',
  app,
};
