import { addDays, dayOf } from '../../stats.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- aggregate SQL rows; each query has its own shape
type Row = Record<string, any>;
const all = async (db: D1Database, sql: string, ...b: unknown[]) =>
  (
    await db
      .prepare(sql)
      .bind(...b)
      .all<Row>()
  ).results;

/** Everything the Analytics tab shows, for the last `days` UTC days (today included). */
export async function overview(db: D1Database, days: number) {
  const to = dayOf(),
    from = addDays(to, -(days - 1)),
    prevFrom = addDays(from, -days);
  const [daily, visitors, tools, toolVisitors, series, dims, paths, prev, prevV] = await Promise.all([
    all(db, 'SELECT day, SUM(hits) hits, SUM(err4) err4, SUM(err5) err5, SUM(ms) ms FROM stats_daily WHERE day >= ? GROUP BY day', from),
    all(db, 'SELECT day, COUNT(DISTINCT vh) v FROM stats_visitor WHERE day >= ? GROUP BY day', from),
    all(db, 'SELECT tool, SUM(hits) hits, SUM(err4) err4, SUM(err5) err5, SUM(ms) ms FROM stats_daily WHERE day >= ? GROUP BY tool ORDER BY hits DESC', from),
    all(db, 'SELECT tool, COUNT(*) v FROM stats_visitor WHERE day >= ? GROUP BY tool', from),
    all(db, 'SELECT tool, day, hits FROM stats_daily WHERE day >= ?', from),
    all(db, 'SELECT kind, key, SUM(n) n FROM stats_dim WHERE day >= ? GROUP BY kind, key ORDER BY n DESC', from),
    all(db, 'SELECT tool, path, SUM(n) n FROM stats_path WHERE day >= ? GROUP BY tool, path ORDER BY n DESC LIMIT 25', from),
    // The same span just before, for "vs previous period".
    all(db, 'SELECT SUM(hits) hits, SUM(err4) err4, SUM(err5) err5, SUM(ms) ms FROM stats_daily WHERE day >= ? AND day < ?', prevFrom, from),
    all(db, 'SELECT day, COUNT(DISTINCT vh) v FROM stats_visitor WHERE day >= ? AND day < ? GROUP BY day', prevFrom, from),
  ]);
  const p = prev[0] ?? {};
  const dayList = Array.from({ length: days }, (_, i) => addDays(from, i));
  const dmap = new Map(daily.map((r) => [r.day, r])),
    vmap = new Map(visitors.map((r) => [r.day, r.v]));
  const sum = (k: string) => daily.reduce((a, r) => a + (r[k] ?? 0), 0);
  const hits = sum('hits');
  const vv = new Map(toolVisitors.map((r) => [r.tool, r.v]));
  const byTool = new Map<string, Map<string, number>>();
  for (const r of series) (byTool.get(r.tool) ?? byTool.set(r.tool, new Map()).get(r.tool)!).set(r.day, r.hits);
  return {
    days,
    from,
    to,
    totals: {
      hits,
      visitors: [...vmap.values()].reduce((a, b) => a + b, 0),
      err4: sum('err4'),
      err5: sum('err5'),
      avgMs: hits ? Math.round(sum('ms') / hits) : 0,
    },
    // Visitor hashes are kept 35 days, so for 90-day ranges the previous period's visitors are partial (null when none survive).
    prev: {
      hits: p.hits ?? 0,
      visitors: prevV.length ? prevV.reduce((a, r) => a + r.v, 0) : null,
      err4: p.err4 ?? 0,
      err5: p.err5 ?? 0,
      avgMs: p.hits ? Math.round(p.ms / p.hits) : 0,
    },
    daily: dayList.map((d) => ({
      day: d,
      hits: dmap.get(d)?.hits ?? 0,
      visitors: vmap.get(d) ?? 0,
      errors: (dmap.get(d)?.err4 ?? 0) + (dmap.get(d)?.err5 ?? 0),
    })),
    tools: tools.map((t) => ({
      tool: t.tool,
      hits: t.hits,
      visitors: vv.get(t.tool) ?? 0,
      err4: t.err4,
      err5: t.err5,
      avgMs: t.hits ? Math.round(t.ms / t.hits) : 0,
      series: dayList.map((d) => byTool.get(t.tool)?.get(d) ?? 0),
    })),
    countries: dims
      .filter((r) => r.kind === 'country')
      .slice(0, 15)
      .map((r) => ({ key: r.key, n: r.n })),
    browsers: dims.filter((r) => r.kind === 'browser').map((r) => ({ key: r.key, n: r.n })),
    devices: dims.filter((r) => r.kind === 'device').map((r) => ({ key: r.key, n: r.n })),
    traps: dims
      .filter((r) => r.kind === 'trap')
      .slice(0, 15)
      .map((r) => ({ key: r.key, n: r.n })),
    paths: paths.map((r) => ({ tool: r.tool, path: r.path, n: r.n })),
  };
}

/** Per-user activity for the last `days` days (requests to sign-in-only tools, logins are lifetime). */
export async function userActivity(db: D1Database, days: number) {
  const from = addDays(dayOf(), -(days - 1));
  const [users, perTool] = await Promise.all([
    all(
      db,
      'SELECT u.id, u.last_login_at, u.logins, COALESCE(SUM(s.n), 0) hits FROM users u LEFT JOIN stats_user s ON s.user_id = u.id AND s.day >= ? GROUP BY u.id',
      from,
    ),
    all(db, 'SELECT user_id, tool, SUM(n) n FROM stats_user WHERE day >= ? GROUP BY user_id, tool ORDER BY n DESC', from),
  ]);
  const tl = new Map<string, { tool: string; n: number }[]>();
  for (const r of perTool) (tl.get(r.user_id) ?? tl.set(r.user_id, []).get(r.user_id)!).push({ tool: r.tool, n: r.n });
  return new Map(users.map((u) => [u.id as string, { hits: u.hits as number, logins: u.logins as number, tools: (tl.get(u.id) ?? []).slice(0, 5) }]));
}

/** Endpoints with errors (4xx other than 404, which isn't recorded, and 5xx), worst first. Paths are kept 60 days. */
export async function errors(db: D1Database, days: number) {
  const from = addDays(dayOf(), -(days - 1));
  return (
    await all(
      db,
      'SELECT tool, path, SUM(n) n, SUM(e4) e4, SUM(e5) e5 FROM stats_path WHERE day >= ? GROUP BY tool, path HAVING SUM(e4) + SUM(e5) > 0 ORDER BY SUM(e5) DESC, SUM(e4) DESC LIMIT 25',
      from,
    )
  ).map((r) => ({ tool: r.tool, path: r.path, n: r.n, e4: r.e4, e5: r.e5 }));
}

/** One tool: daily requests, visitors, errors and response time, plus its endpoints. */
export async function toolDetail(db: D1Database, tool: string, days: number) {
  const to = dayOf(),
    from = addDays(to, -(days - 1));
  const [daily, visitors, paths] = await Promise.all([
    all(db, 'SELECT day, hits, err4, err5, ms FROM stats_daily WHERE tool = ? AND day >= ?', tool, from),
    all(db, 'SELECT day, COUNT(*) v FROM stats_visitor WHERE tool = ? AND day >= ? GROUP BY day', tool, from),
    all(db, 'SELECT path, SUM(n) n, SUM(e4) e4, SUM(e5) e5 FROM stats_path WHERE tool = ? AND day >= ? GROUP BY path ORDER BY n DESC LIMIT 30', tool, from),
  ]);
  const dmap = new Map(daily.map((r) => [r.day, r])),
    vmap = new Map(visitors.map((r) => [r.day, r.v]));
  return {
    tool,
    days,
    from,
    to,
    daily: Array.from({ length: days }, (_, i) => addDays(from, i)).map((d) => {
      const r = dmap.get(d);
      return {
        day: d,
        hits: r?.hits ?? 0,
        visitors: vmap.get(d) ?? 0,
        errors: (r?.err4 ?? 0) + (r?.err5 ?? 0),
        avgMs: r?.hits ? Math.round(r.ms / r.hits) : 0,
      };
    }),
    paths: paths.map((r) => ({ path: r.path, n: r.n, e4: r.e4, e5: r.e5 })),
  };
}
