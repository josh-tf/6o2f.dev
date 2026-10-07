// Discord SSO for the whole domain. Login happens on the apex; the session cookie is scoped to .DOMAIN so every
// tool subdomain can verify it statelessly (HMAC) and re-check the user against D1. Curl clients use API tokens.
import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import { makeSession, readSession } from './session.ts';
import { settings } from './settings.ts';
import { userHit } from './stats.ts';

export type User = { id: string; name: string | null; avatar: string | null; isAdmin: boolean; tools: string; via: 'cookie' | 'token' };
export type AppEnv = { Bindings: Env; Variables: { user: User; bot: boolean } };

const SESSION_TTL = 30 * 86400;
const DISCORD_ID = /^\d{15,25}$/;
const adminIds = (env: Env) =>
  new Set(
    env.ADMIN_IDS.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
// Session cookie: __Secure- (not __Host-, which forbids Domain) so it is shared by *.DOMAIN.
const sessionCookie = (env: Env) => ({ prefix: 'secure', domain: `.${env.DOMAIN}`, path: '/', secure: true, httpOnly: true, sameSite: 'Lax' }) as const;
const hostCookie = { prefix: 'host', path: '/', secure: true, httpOnly: true, sameSite: 'Lax' } as const;

export const fail = (status: 400 | 401 | 403 | 404 | 409 | 413 | 429, message: string): never => {
  throw new HTTPException(status, { message });
};

const sha256hex = async (s: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');

type Row = { id: string; name: string | null; avatar: string | null; is_admin: number; sessions_after: number; tools: string; suspended: number };
/** Suspended users are signed out everywhere and treated as visitors (admins in ADMIN_IDS can't be suspended). */
const blocked = (env: Env, r: Row) => !!r.suspended && !adminIds(env).has(r.id);
const toUser = (env: Env, r: Row, via: User['via']): User => ({
  id: r.id,
  name: r.name,
  avatar: r.avatar,
  isAdmin: !!r.is_admin || adminIds(env).has(r.id),
  tools: r.tools,
  via,
});

export async function authenticate(c: Context<AppEnv>): Promise<User | null> {
  const bearer = c.req.header('authorization')?.match(/^Bearer (6o2f_[A-Za-z0-9_-]{20,})$/)?.[1];
  if (bearer) {
    const r = await c.env.DB.prepare('SELECT u.*, t.id AS token_id, t.last_used_at FROM tokens t JOIN users u ON u.id = t.user_id WHERE t.hash = ?')
      .bind(await sha256hex(bearer))
      .first<Row & { token_id: string; last_used_at: number | null }>();
    if (!r || blocked(c.env, r)) return null;
    // last_used_at is hourly-granular: one D1 write per token per hour, not per request.
    if (Date.now() - (r.last_used_at ?? 0) > 3600_000)
      c.executionCtx.waitUntil(c.env.DB.prepare('UPDATE tokens SET last_used_at = ? WHERE id = ?').bind(Date.now(), r.token_id).run());
    return toUser(c.env, r, 'token');
  }
  const s = await readSession(c.env.SESSION_SECRET, getCookie(c, 's', sessionCookie(c.env).prefix));
  if (!s) return null;
  const r = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(s.userId).first<Row>();
  // Sessions issued before the user's last logout are revoked.
  if (!r || blocked(c.env, r) || s.exp - SESSION_TTL < r.sessions_after) return null;
  // Cookie-authenticated writes must come from our own origin (CSRF); bearer requests carry no ambient credential.
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    const origin = c.req.header('origin');
    // Same origin only: sibling tool hosts are not trusted, so script on one tool cannot write as the user on another (admin included).
    if (!sameOrigin(origin, c.req.url, c.req.header('sec-fetch-site'))) fail(403, 'Cross-origin request refused');
  }
  return toUser(c.env, r, 'cookie');
}

/** CSRF check for cookie-authenticated writes: Origin must equal the request's origin (or, without Origin, Sec-Fetch-Site same-origin). */
export const sameOrigin = (origin: string | undefined, url: string, fetchSite: string | undefined) =>
  origin ? origin === new URL(url).origin : fetchSite === 'same-origin';

/** Tool name of the request's host ('' for the apex). */
export const toolOf = (c: Context<AppEnv>) => {
  const host = (c.env.DEV && c.req.header('x-host')) || new URL(c.req.url).hostname;
  return host.endsWith(`.${c.env.DOMAIN}`) ? host.slice(0, -c.env.DOMAIN.length - 1) : '';
};
export const canUse = (u: Pick<User, 'isAdmin' | 'tools'>, tool: string) =>
  !tool || u.isAdmin || (tool !== 'admin' && u.tools === '*') || (tool !== 'admin' && u.tools.split(',').includes(tool));

/** Login required (session cookie or Bearer token). Browsers asking for HTML are sent to Discord login; others get 401 JSON. */
export const gate: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = await authenticate(c);
  if (!user) {
    if (c.req.method === 'GET' && c.req.header('accept')?.includes('text/html'))
      return c.redirect(`https://${c.env.DOMAIN}/auth/login?next=${encodeURIComponent(c.req.url)}`, 302);
    fail(401, 'Not signed in');
  }
  if (!canUse(user!, toolOf(c))) fail(403, 'You do not have access to this tool');
  c.executionCtx.waitUntil(userHit(c.env, user!.id, toolOf(c)));
  c.set('user', user!);
  await next();
};

export const adminOnly: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get('user').isAdmin) fail(403, 'Admins only');
  await next();
};

/** Serves public/_/<tool>/ (index.html) — call after `gate` so login protects the page. */
export const page = (c: Context<AppEnv>, tool: string) => c.env.ASSETS.fetch(new Request(new URL(`/_/${tool}/`, c.req.url)));

export const avatarUrl = (u: { id: string; avatar: string | null }) => (u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64` : null);

const safeNext = (env: Env, next: string | undefined) => {
  try {
    const u = new URL(next ?? '');
    if (u.protocol === 'https:' && (u.hostname === env.DOMAIN || u.hostname.endsWith(`.${env.DOMAIN}`))) return u.toString();
  } catch {}
  return '/';
};

export const auth = new Hono<AppEnv>();

auth.get('/login', (c) => {
  const state = crypto.randomUUID();
  setCookie(c, 'oauth_state', state, { ...hostCookie, maxAge: 600 });
  setCookie(c, 'oauth_next', safeNext(c.env, c.req.query('next')), { ...hostCookie, maxAge: 600 });
  const url = new URL('https://discord.com/oauth2/authorize');
  url.search = new URLSearchParams({
    client_id: c.env.DISCORD_CLIENT_ID,
    redirect_uri: `${new URL(c.req.url).origin}/auth/callback`,
    response_type: 'code',
    scope: 'identify',
    state,
  }).toString();
  return c.redirect(url.toString(), 302);
});

auth.get('/callback', async (c) => {
  const back = (error: string, extra = '') => c.redirect(`/?error=${error}${extra}`, 302);
  const expected = getCookie(c, 'oauth_state', 'host');
  const next = safeNext(c.env, getCookie(c, 'oauth_next', 'host'));
  deleteCookie(c, 'oauth_state', hostCookie);
  deleteCookie(c, 'oauth_next', hostCookie);
  const { code, state, error } = c.req.query();
  if (error) return back('cancelled');
  if (!code || !state || !expected || state !== expected) return back('state');

  const tok = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: c.env.DISCORD_CLIENT_ID,
      client_secret: c.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${new URL(c.req.url).origin}/auth/callback`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!tok.ok) return back('discord');
  const { access_token } = await tok.json<{ access_token: string }>();
  const me = await fetch('https://discord.com/api/users/@me', {
    headers: { authorization: `Bearer ${access_token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!me.ok) return back('discord');
  const p = await me.json<{ id: string; username: string; global_name: string | null; avatar: string | null }>();
  if (!DISCORD_ID.test(p.id)) return back('discord');
  const name = (p.global_name || p.username || '').slice(0, 100) || null;
  const avatar = p.avatar && /^(a_)?[0-9a-f]{32}$/.test(p.avatar) ? p.avatar : null;
  const now = Date.now(); // new rows get sessions_after = now (Worker clock, same as makeSession): cookies from before a deletion stay revoked

  if (adminIds(c.env).has(p.id)) {
    await c.env.DB.prepare(
      `INSERT INTO users (id, name, avatar, is_admin, created_at, last_login_at, logins, sessions_after) VALUES (?, ?, ?, 1, ?, ?, 1, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, avatar = excluded.avatar, last_login_at = excluded.last_login_at, logins = logins + 1`,
    )
      .bind(p.id, name, avatar, now, now, Math.floor(now / 1000))
      .run();
  } else {
    if ((await c.env.DB.prepare('SELECT suspended FROM users WHERE id = ?').bind(p.id).first<{ suspended: number }>())?.suspended) return back('suspended');
    // Anyone who signs in is recorded. New people get the admin panel's default grant: '' (no locked tools, waiting for approval),
    // '*' or a list. Existing rows keep their grant.
    await c.env.DB.prepare(
      `INSERT INTO users (id, name, avatar, is_admin, tools, created_at, last_login_at, logins, sessions_after) VALUES (?1, ?2, ?3, 0, ?6, ?4, ?4, 1, ?5)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, avatar = excluded.avatar, last_login_at = excluded.last_login_at, logins = logins + 1`,
    )
      .bind(p.id, name, avatar, now, Math.floor(now / 1000), (await settings(c.env)).defaultTools)
      .run();
  }
  setCookie(c, 's', await makeSession(c.env.SESSION_SECRET, p.id, SESSION_TTL), { ...sessionCookie(c.env), maxAge: SESSION_TTL });
  return c.redirect(next, 302);
});

/** Revokes every session of the user (all devices) and clears the cookie. */
export const logout = async (c: Context<AppEnv>) => {
  const u = c.get('user');
  await c.env.DB.prepare('UPDATE users SET sessions_after = unixepoch() WHERE id = ?').bind(u.id).run();
  deleteCookie(c, 's', sessionCookie(c.env));
  return c.body(null, 204);
};

export { sha256hex };
