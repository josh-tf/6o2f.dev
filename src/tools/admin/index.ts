import { Hono, type Context } from 'hono';
import { ADMIN_TOOLS, adminOnly, avatarUrl, fail, gate, page, type AppEnv } from '../../auth.ts';
import { tools } from '../index.ts';
import type { Tool } from '../types.ts';
import { errors, overview, toolDetail, userActivity } from './stats.ts';
import { clearSettings, settings } from '../../settings.ts';

const app = new Hono<AppEnv>();

/** Discord profile by user id. Needs DISCORD_BOT_TOKEN (any bot of the app); returns null if unset or the lookup fails. */
const lookup = async (env: Env, id: string) => {
  const token = (env as Env & { DISCORD_BOT_TOKEN?: string }).DISCORD_BOT_TOKEN;
  if (!token) return null;
  const r = await fetch(`https://discord.com/api/v10/users/${id}`, { headers: { authorization: `Bot ${token}` }, signal: AbortSignal.timeout(5000) }).catch(
    () => null,
  );
  if (!r?.ok) return null;
  const p = await r.json<{ username: string; global_name: string | null; avatar: string | null }>();
  return { name: (p.global_name || p.username || '').slice(0, 100) || null, avatar: p.avatar && /^(a_)?[0-9a-f]{32}$/.test(p.avatar) ? p.avatar : null };
};
app.use('*', gate, adminOnly);

/** Audit log: one row per admin change. detail is JSON (or null). */
const audit = (c: Context<AppEnv>, action: string, target: string | null, detail?: unknown) =>
  c.env.DB.prepare('INSERT INTO admin_log (at, admin_id, action, target, detail) VALUES (?, ?, ?, ?, ?)')
    .bind(Date.now(), c.get('user').id, action, target, detail === undefined ? null : JSON.stringify(detail))
    .run();
const body = <T>(c: Context<AppEnv>) => c.req.json<T>().catch(() => ({}) as T);
app.get('/', (c) => page(c, 'admin'));

// Which tool names can be granted (public tools need no grant; admin-only tools come with the admin switch).
const grantable = () => tools.filter((t) => !ADMIN_TOOLS.has(t.name) && !t.public).map((t) => t.name);
const permanent = (env: Env) => new Set(env.ADMIN_IDS.split(',').map((s) => s.trim()));

app.get('/api/users', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, name, avatar, is_admin, tools, created_at, last_login_at, logins, suspended FROM users ORDER BY created_at',
  ).all<{ id: string; name: string | null; avatar: string | null; is_admin: number; tools: string; suspended: number }>();
  // Backfill names for users who have not signed in yet (added by id).
  await Promise.all(
    results
      .filter((u) => !u.name)
      .slice(0, 10)
      .map(async (u) => {
        const p = await lookup(c.env, u.id);
        if (p) {
          Object.assign(u, p);
          await c.env.DB.prepare('UPDATE users SET name = ?, avatar = ? WHERE id = ?').bind(p.name, p.avatar, u.id).run();
        }
      }),
  );
  const [perm, act] = [permanent(c.env), await userActivity(c.env.DB, 30)];
  return c.json({
    tools: grantable(),
    users: results.map((u) => {
      const isAdmin = !!u.is_admin || perm.has(u.id),
        a = act.get(u.id);
      return {
        ...u,
        avatarUrl: avatarUrl(u),
        is_admin: isAdmin,
        permanent: perm.has(u.id),
        suspended: !!u.suspended && !perm.has(u.id),
        no_access: !isAdmin && !u.suspended && u.tools === '',
        hits30: a?.hits ?? 0,
        topTools: a?.tools ?? [],
      };
    }),
  });
});

/** Parses a tools grant: '*' (every locked tool, now and later) or a list of valid tool names. */
const parseTools = (v: unknown) => {
  if (v === '*') return '*';
  if (!Array.isArray(v) || !v.every((x) => typeof x === 'string' && grantable().includes(x))) return fail(400, 'Invalid tool list');
  return [...new Set(v)].join(',');
};

app.post('/api/users', async (c) => {
  const b = await c.req.json<{ id?: string; tools?: unknown }>().catch(() => ({}) as { id?: string; tools?: unknown });
  const id = String(b.id ?? '').trim();
  if (!/^\d{15,25}$/.test(id)) fail(400, 'Enter a Discord user id (digits only)');
  const p = await lookup(c.env, id);
  await c.env.DB.prepare(
    'INSERT INTO users (id, name, avatar, is_admin, tools, created_at, sessions_after) VALUES (?, ?, ?, 0, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET tools = excluded.tools',
  )
    .bind(id, p?.name ?? null, p?.avatar ?? null, parseTools(b.tools ?? '*'), Date.now(), Math.floor(Date.now() / 1000))
    .run(); // new rows: cookies from before a deletion stay revoked
  await audit(c, 'user.add', id, { tools: b.tools ?? '*' });
  return c.body(null, 204);
});

app.put('/api/users/:id/tools', async (c) => {
  const b = await c.req.json<{ tools?: unknown }>().catch(() => ({}) as { tools?: unknown });
  const r = await c.env.DB.prepare('UPDATE users SET tools = ? WHERE id = ?').bind(parseTools(b.tools), c.req.param('id')).run();
  if (!r.meta.changes) fail(404, 'No such user');
  await audit(c, 'user.tools', c.req.param('id'), { tools: b.tools });
  return c.body(null, 204);
});

// Admin rights. Admins listed in ADMIN_IDS (deploy-time setting) are permanent; everyone else can be promoted or demoted here.
app.put('/api/users/:id/admin', async (c) => {
  const id = c.req.param('id');
  const b = await c.req.json<{ admin?: unknown }>().catch(() => ({}) as { admin?: unknown });
  if (typeof b.admin !== 'boolean') fail(400, 'admin must be true or false');
  if (!b.admin && permanent(c.env).has(id)) fail(400, 'This admin is set in the deployment and cannot be demoted here');
  if (!b.admin && id === c.get('user').id) fail(400, 'You cannot remove your own admin rights');
  const r = await c.env.DB.prepare('UPDATE users SET is_admin = ? WHERE id = ?')
    .bind(b.admin ? 1 : 0, id)
    .run();
  if (!r.meta.changes) fail(404, 'No such user');
  await audit(c, b.admin ? 'user.promote' : 'user.demote', id);
  return c.body(null, 204);
});

app.delete('/api/users/:id', async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT is_admin FROM users WHERE id = ?').bind(id).first<{ is_admin: number }>();
  if (id === c.get('user').id || permanent(c.env).has(id) || row?.is_admin) fail(400, 'Remove admin rights first (admins cannot be deleted)');
  await deleteUserData(c.env, id);
  await audit(c, 'user.delete', id);
  return c.body(null, 204);
});

// Suspend: signs the user out everywhere, ignores their API tokens and refuses new sign-ins. Admins must be demoted first.
app.put('/api/users/:id/suspend', async (c) => {
  const id = c.req.param('id'),
    b = await body<{ suspended?: unknown }>(c);
  if (typeof b.suspended !== 'boolean') fail(400, 'suspended must be true or false');
  const row = await c.env.DB.prepare('SELECT is_admin FROM users WHERE id = ?').bind(id).first<{ is_admin: number }>();
  if (!row) fail(404, 'No such user');
  if (b.suspended && (id === c.get('user').id || permanent(c.env).has(id) || row!.is_admin))
    fail(400, 'Remove admin rights first (admins cannot be suspended)');
  await c.env.DB.prepare(`UPDATE users SET suspended = ?${b.suspended ? ', sessions_after = unixepoch()' : ''} WHERE id = ?`)
    .bind(b.suspended ? 1 : 0, id)
    .run();
  await audit(c, b.suspended ? 'user.suspend' : 'user.unsuspend', id);
  return c.body(null, 204);
});

// Sign out everywhere: every session cookie issued before now stops working (API tokens are separate, below).
app.post('/api/users/:id/signout', async (c) => {
  const r = await c.env.DB.prepare('UPDATE users SET sessions_after = unixepoch() WHERE id = ?').bind(c.req.param('id')).run();
  if (!r.meta.changes) fail(404, 'No such user');
  await audit(c, 'user.signout', c.req.param('id'));
  return c.body(null, 204);
});

/** One user's API tokens, what they store, and per-tool activity (30 days). */
app.get('/api/users/:id', async (c) => {
  const id = c.req.param('id'),
    DB = c.env.DB;
  const one = (sql: string) => DB.prepare(sql).bind(id).first<{ n: number; b?: number }>();
  const kvCount = async (ns: KVNamespace) => (await ns.list({ prefix: `u:${id}:` })).keys.length; // ponytail: counts the first 1000
  const [tokens, drop, stash, polls, countdowns, monitors, hooks, feeds, ai, pastes, links, act] = await Promise.all([
    DB.prepare('SELECT id, name, created_at, last_used_at FROM tokens WHERE user_id = ? ORDER BY created_at DESC').bind(id).all(),
    one('SELECT COUNT(*) n, COALESCE(SUM(size), 0) b FROM drop_files WHERE user_id = ?'),
    one('SELECT COUNT(*) n, COALESCE(SUM(LENGTH(value)), 0) b FROM stash_kv WHERE user_id = ?'),
    one('SELECT COUNT(*) n FROM vote_polls WHERE user_id = ?'),
    one('SELECT COUNT(*) n FROM countdown_events WHERE user_id = ?'),
    one('SELECT COUNT(*) n FROM uptime_monitors WHERE user_id = ?'),
    one('SELECT COUNT(*) n FROM hook_endpoints WHERE user_id = ?'),
    one('SELECT COUNT(*) n FROM rss_feeds WHERE user_id = ?'),
    DB.prepare('SELECT n FROM ai_usage WHERE user_id = ? AND day = ?').bind(id, new Date().toISOString().slice(0, 10)).first<{ n: number }>(),
    kvCount(c.env.PASTE),
    kvCount(c.env.LINKS),
    userActivity(DB, 30),
  ]);
  return c.json({
    tokens: tokens.results,
    storage: {
      drop: { n: drop?.n ?? 0, bytes: drop?.b ?? 0 },
      stash: { n: stash?.n ?? 0, bytes: stash?.b ?? 0 },
      pastes,
      links,
      polls: polls?.n ?? 0,
      countdowns: countdowns?.n ?? 0,
      monitors: monitors?.n ?? 0,
      hooks: hooks?.n ?? 0,
      feeds: feeds?.n ?? 0,
      aiToday: ai?.n ?? 0,
    },
    activity: act.get(id)?.tools ?? [],
  });
});

app.delete('/api/users/:id/tokens/:tid', async (c) => {
  const r = await c.env.DB.prepare('DELETE FROM tokens WHERE id = ? AND user_id = ?').bind(c.req.param('tid'), c.req.param('id')).run();
  if (!r.meta.changes) fail(404, 'No such token');
  await audit(c, 'token.revoke', c.req.param('id'), { token: c.req.param('tid') });
  return c.body(null, 204);
});

/* ---------- site controls ---------- */
// Tools that can be switched off: everything except admin (you'd lock yourself out).
const switchable = () => tools.filter((t) => !ADMIN_TOOLS.has(t.name)).map((t) => ({ name: t.name, title: t.title, public: !!t.public }));
app.get('/api/settings', async (c) => {
  clearSettings();
  const s = await settings(c.env);
  return c.json({ tools: switchable().map((t) => ({ ...t, state: s.tools[t.name] ?? 'on' })), defaultTools: s.defaultTools, grantable: grantable() });
});
app.put('/api/settings', async (c) => {
  const b = await body<{ tool?: unknown; state?: unknown; defaultTools?: unknown }>(c);
  if (b.tool !== undefined) {
    if (typeof b.tool !== 'string' || !switchable().some((t) => t.name === b.tool)) fail(400, 'Unknown tool');
    if (!['on', 'off', 'maintenance'].includes(b.state as string)) fail(400, 'state must be on, off or maintenance');
    await (
      b.state === 'on'
        ? c.env.DB.prepare('DELETE FROM settings WHERE key = ?').bind(`tool:${b.tool}`)
        : c.env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(
            `tool:${b.tool}`,
            b.state,
          )
    ).run();
    await audit(c, 'tool.state', b.tool as string, { state: b.state });
  }
  if (b.defaultTools !== undefined) {
    const v = b.defaultTools === '' ? '' : parseTools(b.defaultTools);
    await c.env.DB.prepare("INSERT INTO settings (key, value) VALUES ('default_tools', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(v).run();
    await audit(c, 'settings.default_tools', null, { tools: v });
  }
  clearSettings();
  return c.body(null, 204);
});

/* ---------- audit log ---------- */
app.get('/api/log', async (c) => {
  const before = Number(c.req.query('before')) || Number.MAX_SAFE_INTEGER;
  const { results } = await c.env.DB.prepare(
    'SELECT l.id, l.at, l.admin_id, a.name AS admin_name, l.action, l.target, t.name AS target_name, l.detail FROM admin_log l LEFT JOIN users a ON a.id = l.admin_id LEFT JOIN users t ON t.id = l.target WHERE l.id < ? ORDER BY l.id DESC LIMIT 100',
  )
    .bind(before)
    .all();
  return c.json(results);
});

/* ---------- moderation ---------- */
// Everything users publish at a public URL. KV-backed kinds are read from their per-user index keys (u:<owner>:<id>).
type Item = { kind: string; id: string; title: string; url: string; owner: string; created: number; expires: number | null; size?: number };
const KINDS = ['link', 'paste', 'poll', 'countdown', 'drop', 'hook'] as const;
app.get('/api/content', async (c) => {
  const D = c.env.DOMAIN,
    DB = c.env.DB;
  const rows = async <T>(sql: string) => (await DB.prepare(sql).all<T>()).results;
  // ponytail: newest 200 per kind; KV kinds see the first 1000 index keys (KV lists by key, not time).
  const [links, pastes, polls, countdowns, drops, hooks] = await Promise.all([
    c.env.LINKS.list<{ created: number; exp: number | null }>({ prefix: 'u:' }),
    c.env.PASTE.list<{ created: number; expires: number; size: number; preview: string }>({ prefix: 'u:' }),
    rows<{ id: string; user_id: string; question: string; created_at: number; closes_at: number }>(
      'SELECT id, user_id, question, created_at, closes_at FROM vote_polls ORDER BY created_at DESC LIMIT 200',
    ),
    rows<{ id: string; user_id: string; title: string; created_at: number; target: number }>(
      'SELECT id, user_id, title, created_at, target FROM countdown_events ORDER BY created_at DESC LIMIT 200',
    ),
    rows<{ id: string; user_id: string; name: string; size: number; created_at: number; expires_at: number }>(
      'SELECT id, user_id, name, size, created_at, expires_at FROM drop_files ORDER BY created_at DESC LIMIT 200',
    ),
    rows<{ id: string; user_id: string; name: string | null; created_at: number }>(
      'SELECT id, user_id, name, created_at FROM hook_endpoints ORDER BY created_at DESC LIMIT 200',
    ),
  ]);
  const split = (name: string) => {
    const [, owner, ...rest] = name.split(':');
    return { owner, id: rest.join(':') };
  };
  const newest = <T extends { metadata?: { created?: number } }>(keys: T[]) =>
    keys.sort((a, b) => (b.metadata?.created ?? 0) - (a.metadata?.created ?? 0)).slice(0, 200);
  const linkKeys = newest(links.keys);
  const linkUrls = await Promise.all(linkKeys.map((k) => c.env.LINKS.get(k.name)));
  const items: Item[] = [
    ...linkKeys.map((k, i) => {
      const { owner, id } = split(k.name);
      return {
        kind: 'link',
        id,
        title: linkUrls[i] ?? '(expired)',
        url: `https://s.${D}/${id}`,
        owner,
        created: k.metadata?.created ?? 0,
        expires: k.metadata?.exp ?? null,
      };
    }),
    ...newest(pastes.keys).map((k) => {
      const { owner, id } = split(k.name);
      return {
        kind: 'paste',
        id,
        title: k.metadata?.preview ?? '',
        url: `https://paste.${D}/${id}`,
        owner,
        created: k.metadata?.created ?? 0,
        expires: k.metadata?.expires ?? null,
        size: k.metadata?.size,
      };
    }),
    ...polls.map((r) => ({
      kind: 'poll',
      id: r.id,
      title: r.question,
      url: `https://vote.${D}/p/${r.id}`,
      owner: r.user_id,
      created: r.created_at,
      expires: r.closes_at,
    })),
    ...countdowns.map((r) => ({
      kind: 'countdown',
      id: r.id,
      title: r.title,
      url: `https://countdown.${D}/c/${r.id}`,
      owner: r.user_id,
      created: r.created_at,
      expires: null,
    })),
    ...drops.map((r) => ({
      kind: 'drop',
      id: r.id,
      title: r.name,
      url: `https://drop.${D}/d/${r.id}/${encodeURIComponent(r.name)}`,
      owner: r.user_id,
      created: r.created_at,
      expires: r.expires_at,
      size: r.size,
    })),
    ...hooks.map((r) => ({
      kind: 'hook',
      id: r.id,
      title: r.name || '(unnamed endpoint)',
      url: `https://hook.${D}/h/${r.id}`,
      owner: r.user_id,
      created: r.created_at,
      expires: null,
    })),
  ];
  const owners = [...new Set(items.map((i) => i.owner))];
  const names = new Map<string, string | null>();
  for (let i = 0; i < owners.length; i += 90) {
    // D1 caps bound parameters at 100
    const part = owners.slice(i, i + 90);
    const { results } = await DB.prepare(`SELECT id, name FROM users WHERE id IN (${part.map(() => '?').join(',')})`)
      .bind(...part)
      .all<{ id: string; name: string | null }>();
    for (const r of results) names.set(r.id, r.name);
  }
  return c.json({
    items: items.sort((a, b) => b.created - a.created).map((i) => ({ ...i, ownerName: names.get(i.owner) ?? null })),
    truncated: !links.list_complete || !pastes.list_complete,
  });
});

app.delete('/api/content/:kind/:id', async (c) => {
  const kind = c.req.param('kind') as (typeof KINDS)[number],
    id = c.req.param('id'),
    env = c.env,
    DB = env.DB;
  if (!KINDS.includes(kind) || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) fail(400, 'Bad content id');
  let owner: string | null = null;
  if (kind === 'link') {
    const rec = await env.LINKS.get<{ owner: string }>(`l:${id}`, 'json');
    owner = rec?.owner ?? c.req.query('owner') ?? null;
    await Promise.all([env.LINKS.delete(`l:${id}`), owner ? env.LINKS.delete(`u:${owner}:${id}`) : null]);
  } else if (kind === 'paste') {
    owner = c.req.query('owner') ?? null;
    if (!owner || !/^\d{15,25}$/.test(owner)) fail(400, 'owner is required for pastes');
    await Promise.all([env.PASTE.delete(`p:${id}`), env.PASTE.delete(`u:${owner}:${id}`)]);
  } else if (kind === 'poll') {
    owner = (await DB.prepare('SELECT user_id FROM vote_polls WHERE id = ?').bind(id).first<{ user_id: string }>())?.user_id ?? null;
    await DB.batch([DB.prepare('DELETE FROM vote_votes WHERE poll_id = ?').bind(id), DB.prepare('DELETE FROM vote_polls WHERE id = ?').bind(id)]);
  } else if (kind === 'countdown') {
    owner = (await DB.prepare('DELETE FROM countdown_events WHERE id = ? RETURNING user_id').bind(id).first<{ user_id: string }>())?.user_id ?? null;
  } else if (kind === 'drop') {
    const r = await DB.prepare('DELETE FROM drop_files WHERE id = ? RETURNING user_id, r2_key').bind(id).first<{ user_id: string; r2_key: string }>();
    if (r) {
      owner = r.user_id;
      await env.DROP.delete(r.r2_key);
    }
  } else if (kind === 'hook') {
    owner = (await DB.prepare('DELETE FROM hook_endpoints WHERE id = ? RETURNING user_id').bind(id).first<{ user_id: string }>())?.user_id ?? null;
    await env.HOOK.get(env.HOOK.idFromName(id)).destroy();
  }
  await audit(c, 'content.delete', owner, { kind, id });
  return c.body(null, 204);
});

/** Deletes a user and everything they own: tool rows, hook inboxes, drop files (R2) and their mail account. Tokens cascade.
 *  ponytail: KV data (paste, clip, s links) is left to its own expiry; s links with ttl 'never' stay until removed by hand. */
export async function deleteUserData(env: Env, id: string) {
  const DB = env.DB;
  const hooks = (await DB.prepare('SELECT id FROM hook_endpoints WHERE user_id = ?').bind(id).all<{ id: string }>()).results;
  await Promise.all(hooks.map((h) => env.HOOK.get(env.HOOK.idFromName(h.id)).destroy()));
  const files = (await DB.prepare('SELECT r2_key FROM drop_files WHERE user_id = ?').bind(id).all<{ r2_key: string }>()).results;
  if (files.length) await env.DROP.delete(files.map((f) => f.r2_key));
  await DB.batch(
    [
      'DELETE FROM uptime_checks WHERE monitor_id IN (SELECT id FROM uptime_monitors WHERE user_id = ?1)',
      'DELETE FROM uptime_monitors WHERE user_id = ?1',
      'DELETE FROM hook_endpoints WHERE user_id = ?1',
      'DELETE FROM drop_files WHERE user_id = ?1',
      'DELETE FROM stash_kv WHERE user_id = ?1',
      'DELETE FROM rss_feeds WHERE user_id = ?1',
      'DELETE FROM vote_votes WHERE poll_id IN (SELECT id FROM vote_polls WHERE user_id = ?1)',
      'DELETE FROM vote_polls WHERE user_id = ?1',
      'DELETE FROM countdown_events WHERE user_id = ?1',
      'DELETE FROM ai_usage WHERE user_id = ?1',
      'DELETE FROM stats_user WHERE user_id = ?1',
      'DELETE FROM users WHERE id = ?1',
    ].map((q) => DB.prepare(q).bind(id)),
  );
  // Mail privileges (is_admin, see_all, alias access) must not come back if the id is re-approved.
  await env.MAILDB.batch(['DELETE FROM alias_access WHERE user_id = ?', 'DELETE FROM users WHERE id = ?'].map((q) => env.MAILDB.prepare(q).bind(id)));
}

/** Analytics for the last 7, 30 or 90 days. Counters only: no IPs or user agents are stored. */
app.get('/api/stats', async (c) => {
  const n = Number(c.req.query('days')),
    days = [7, 30, 90].includes(n) ? n : 30,
    tool = c.req.query('tool');
  if (tool) return c.json(await toolDetail(c.env.DB, tool, days));
  const [o, e] = await Promise.all([overview(c.env.DB, days), errors(c.env.DB, days)]);
  return c.json({ ...o, errors: e });
});

export const tool: Tool = {
  name: 'admin',
  title: 'Admin',
  blurb: 'Users and tool access',
  icon: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  note: 'Admins only.',
  app,
};
