// Disposable inboxes (ported from 6o2f-mail). Auth = shared `gate`; permissions = mail's own users table in MAILDB.
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { bodyLimit } from 'hono/body-limit';
import { gate, page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';
import { admin } from './admin.ts';
import { aliases } from './aliases.ts';
import { requireUser, type MailEnv } from './auth.ts';
import { avatarUrl, canCreate, deleteMessages, seesAll } from './db.ts';
import { receive } from './mail.ts';
import { messages } from './messages.ts';

const api = new Hono<MailEnv>();
api.use('*', bodyLimit({ maxSize: 64 * 1024, onError: (c) => c.json({ error: 'Request body too large' }, 413) }));
api.use('*', requireUser);
api.get('/me', async (c) => {
  const u = c.get('mu');
  const s = c.get('user');
  // Name and avatar follow Discord (the shared login keeps them fresh).
  await c.env.MAILDB.prepare('UPDATE users SET name = ?, avatar = ?, last_login_at = ? WHERE id = ?').bind(s.name, s.avatar, Date.now(), u.id).run();
  return c.json({
    id: u.id,
    name: s.name ?? u.name ?? u.id,
    avatarUrl: avatarUrl(u.id, s.avatar),
    isAdmin: !!u.is_admin,
    canCreate: canCreate(u),
    seeAll: seesAll(u),
    domain: c.env.DOMAIN,
  });
});
api.route('/aliases', aliases);
api.route('/messages', messages);
api.route('/admin', admin);

const app = new Hono<AppEnv>();
app.use('*', gate);
app.use('*', async (c, next) => {
  await next();
  c.res = new Response(c.res.body, c.res); // ASSETS responses have immutable headers
  c.res.headers.set('cross-origin-resource-policy', 'same-origin');
});
app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: 'Internal error' }, 500);
});
app.route('/api', api);
app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));
// Everything else is the SPA (assets live under /_/mail/ and bypass the Worker).
app.get('*', (c) => page(c, 'mail'));

export const tool: Tool = {
  name: 'mail',
  title: 'Mail',
  blurb: 'Disposable inboxes',
  icon: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  note: 'Needs sign-in and a mail alias.',
  app,
};

export { receive };
/** Daily retention sweep (the Worker's scheduled() export). */
export const sweep = (env: Env) => deleteMessages(env, 'received_at < ?', Date.now() - Number(env.RETENTION_DAYS) * 86400_000);
