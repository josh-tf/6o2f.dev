// Mail permissions live in MAILDB.users; authentication is the shared `gate` (src/auth.ts) in index.ts.
import type { MiddlewareHandler } from 'hono';
import type { User as Shared } from '../../auth.ts';
import { adminIds, type User } from './db.ts';
import { fail } from './validate.ts';

export type MailEnv = { Bindings: Env; Variables: { user: Shared; mu: User } };

/** Maps the signed-in shared user (Discord id) to its mail row; ADMIN_IDS are created on first use. */
export const requireUser: MiddlewareHandler<MailEnv> = async (c, next) => {
  const s = c.get('user');
  const admins = adminIds(c.env);
  // The shared gate already enforced the allowlist and per-tool access (admin panel), so any signed-in user gets a
  // mail row on first use (default: can create aliases); admin/see-all are granted from the mail admin screen.
  await c.env.MAILDB.prepare(
    `INSERT INTO users (id, name, avatar, is_admin, can_create, created_at) VALUES (?1, ?2, ?3, ?4, 1, ?5)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, avatar = excluded.avatar${admins.has(s.id) ? ', is_admin = 1' : ''}`,
  )
    .bind(s.id, s.name, s.avatar, +admins.has(s.id), Date.now())
    .run();
  const u = await c.env.MAILDB.prepare('SELECT * FROM users WHERE id = ?').bind(s.id).first<User>();
  u!.permanent = admins.has(s.id);
  if (u!.permanent) u!.is_admin = 1;
  c.set('mu', u!);
  await next();
};

export const requireAdmin: MiddlewareHandler<MailEnv> = async (c, next) => {
  if (!c.get('mu').is_admin) fail(403, 'Admins only');
  await next();
};
