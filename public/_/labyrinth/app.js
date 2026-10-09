import { $, api, esc, mountBar } from '/_/ui.js';
import { ago, bars, mountTabs, num, spark, stacked, topN, when } from '/_/admin/charts.js';
await mountBar('Labyrinth');

const size = (b) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : b < 1073741824 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1073741824).toFixed(2)} GB`;
/** Words of labyrinth filler as books (a novel is about 90,000 words). */
const books = (w) =>
  w >= 45_000
    ? `≈ ${(w / 90_000).toFixed(w >= 900_000 ? 0 : 1)} novel${w >= 135_000 ? 's' : ''}`
    : `≈ ${Math.max(1, Math.round(w / 300))} book page${w >= 450 ? 's' : ''}`;

/* ---------- bots ---------- */
/** Folds variants of one probe into a family: /.env.local, /.env.bak → /.env*; /config.php.old → /config.php*. */
function trapFamilies(traps) {
  const fam = new Map();
  for (const t of traps) {
    if (t.key === '(flagged)' || t.key.startsWith('/__maze')) continue; // early counter rows, not honeypot paths
    const base = t.key.match(/^\/\.?[^./]+(\.(php|txt|sql|zip|xml|json|ya?ml|ini|log|gz|tar|bak))?/i)?.[0] ?? t.key;
    const f = fam.get(base) ?? { key: base, n: 0, variants: 0 };
    f.n += t.n;
    f.variants += 1;
    fam.set(base, f);
  }
  return [...fam.values()].map((f) => ({ key: f.variants > 1 ? `${f.key}*` : f.key, n: f.n })).sort((a, b) => b.n - a.n);
}
const BK = { trap: 'honeypot', maze: 'labyrinth', flagged: 'while flagged' };
const short = (host) => {
  const p = (host ?? '').split('.');
  return p.length > 2 ? p[0] : 'apex';
};
const where = (host, path) => `<span class="mono">${esc(short(host))}${esc(path ?? '')}</span>`;
const dayLabel = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
let BOTS = null;
async function loadBots() {
  $('#bmsg').textContent = '';
  try {
    BOTS = await api('/api/bots');
  } catch (x) {
    $('#bmsg').textContent = x.message;
    return;
  }
  const d = BOTS,
    s = d.summary,
    dl = d.daily;
  $('#bkpis').innerHTML = [
    ['Flagged now', s.flaggedNow, 'in the labyrinth, up to 24 h', null],
    ['Bot IPs', s.ips7, 'last 7 days', dl.ips],
    ['Honeypot hits', s.traps7, `${num(s.trapsToday)} today`, dl.trap],
    ['Labyrinth pages', d.maze.pages, 'served, last 7 days', dl.maze],
  ]
    .map(([k, v, sub, ser]) => `<div class="kpi"><small>${k}</small><b>${num(v)}</b>${ser ? spark(ser) : ''}<span>${esc(sub)}</span></div>`)
    .join('');
  const series = [
    { key: 'trap', label: 'honeypot hits', cls: 's-trap', vals: dl.trap },
    { key: 'maze', label: 'labyrinth pages', cls: 's-maze', vals: dl.maze },
    { key: 'flagged', label: 'requests while flagged', cls: 's-flag', vals: dl.flagged },
  ];
  $('#blegend').innerHTML = series.map((x) => `<i class="${x.cls}"></i>${x.label}`).join(' ');
  $('#bchart').innerHTML = stacked(dl.days.map(dayLabel), series, 'Bot activity per day, last 7 days');
  // labyrinth
  const crawlers = d.ips.filter((r) => r.maze > 0).sort((a, b) => b.maze - a.maze);
  const c = d.cost;
  $('#lkpis').innerHTML = [
    ['Crawlers', d.maze.crawlers],
    ['Pages served', d.maze.pages],
    ['Deepest crawl', d.maze.deepest ? `${num(d.maze.deepest)} page${d.maze.deepest === 1 ? '' : 's'}` : '—'],
    ['Time held up', c.held ? dur(c.held) : '—'],
    ['Junk they downloaded', size(c.bytes)],
    ['Filler they read', `${num(c.words)} words`, c.words ? books(c.words) : ''],
  ]
    .map(
      ([k, v, sub]) => `<div class="mini"><small>${k}</small><b>${typeof v === 'number' ? num(v) : esc(v)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`,
    )
    .join('');
  $('#lcrawl').innerHTML = crawlers.length
    ? bars(
        crawlers.slice(0, 8).map((r) => ({ key: `${r.ip} ${r.country ?? ''}`, n: r.maze })),
        '',
      ) + '<p class="muted small">Pages each crawler walked through. Real browsers never see the hidden link, so every one of these ignored robots.txt.</p>'
    : '<p class="empty">Nobody has followed the hidden link yet.</p>';
  $('#families').innerHTML = d.families.length
    ? `<thead><tr><th scope="col">Crawler</th><th scope="col">IPs</th><th scope="col">Requests</th><th scope="col">Maze pages</th><th scope="col">Deepest</th><th scope="col">Held up</th><th scope="col">Downloaded</th></tr></thead><tbody>${d.families
        .map(
          (f) =>
            `<tr><td><b>${esc(f.name)}</b> <span class="kind k-${f.type === 'AI' ? 'maze' : f.type === 'Scanner' ? 'trap' : 'flagged'}">${esc(f.type)}</span></td><td>${num(f.ips)}</td><td>${num(f.hits)}</td><td>${num(f.maze)}</td><td>${num(f.deepest)}</td><td>${f.held ? dur(f.held) : '—'}</td><td>${size(f.bytes)}</td></tr>`,
        )
        .join('')}</tbody>`
    : '<tbody><tr><td class="empty">No bots in the last 7 days.</td></tr></tbody>';
  $('#btraps').innerHTML = bars(topN(trapFamilies(d.traps), 8), 'No honeypot hits in the last 7 days.');
  $('#bcountries').innerHTML = bars(
    topN(
      d.countries.map((c) => ({ key: c.key, n: c.n })),
      8,
    ),
    'No bots yet.',
  );
  drawFeed();
}
/** One line per IP: when, who, what they did, where, status. Hosts come from the IP's logged requests. */
function drawFeed() {
  const d = BOTS,
    now = Date.now();
  const rows = [
    ...d.ips,
    ...d.flaggedOnly.map((f) => ({
      ip: f.ip,
      first_path: f.path,
      country: f.country,
      ua: f.ua,
      hits: 0,
      traps: 0,
      maze: 0,
      last_at: f.at,
      flaggedUntil: f.expires,
    })),
  ];
  $('#gcount').textContent = rows.length;
  $('#bfeed').innerHTML = rows.length
    ? rows
        .map((r) => {
          const ev = d.recent.filter((e) => e.ip === r.ip),
            hosts = [...new Set(ev.map((e) => short(e.host)))];
          const parts = [
            r.traps ? `<span class="kind k-trap">honeypot ×${num(r.traps)}</span>` : '',
            r.maze ? `<span class="kind k-maze">labyrinth ×${num(r.maze)}</span>` : '',
            r.hits - r.traps - r.maze > 0 ? `<span class="kind k-flagged">later ×${num(r.hits - r.traps - r.maze)}</span>` : '',
          ].join('');
          const on = hosts.length ? `on ${hosts.slice(0, 4).map(esc).join(', ')}${hosts.length > 4 ? ` +${hosts.length - 4}` : ''}` : '';
          const live = r.flaggedUntil && r.flaggedUntil > now;
          return `<li data-ip="${esc(r.ip)}"><div class="fl">
      <span class="fw">${when(r.last_at)}</span>
      <span class="fi"><b class="mono">${esc(r.ip)}</b> <span class="muted small">${esc(r.country ?? '')}</span><span class="ua muted small" title="${esc(r.ua ?? '')}">${esc(r.ua || '(no user agent)')}</span></span>
      <span class="fd">${parts}<span class="muted small">first <span class="mono">${esc(r.first_path ?? '')}</span> ${on}</span></span>
      <span class="fs">${live ? `<span class="badge warn">flagged</span>` : '<span class="muted small">expired</span>'}</span>
      <span class="fa"><button type="button" data-watch="${esc(r.ip)}">Watch</button><button type="button" data-acts aria-expanded="false">Trail</button>${live ? '<button type="button" data-unflag>Unflag</button>' : ''}</span></div></li>`;
        })
        .join('')
    : '<li class="empty">No bots caught yet. They usually turn up within a day.</li>';
}
$('#breload').addEventListener('click', loadBots);
$('#bfeed').addEventListener('click', async (e) => {
  const li = e.target.closest('li[data-ip]');
  if (!li) return;
  const ip = li.dataset.ip;
  if (e.target.closest('[data-unflag]')) {
    try {
      await api(`/api/guard/${encodeURIComponent(ip)}`, { method: 'DELETE' });
      await loadBots();
    } catch (x) {
      $('#bmsg').textContent = x.message;
    }
    return;
  }
  const btn = e.target.closest('[data-acts]');
  if (!btn) return;
  const open = li.querySelector('.trail');
  if (open) {
    open.remove();
    btn.setAttribute('aria-expanded', 'false');
    return;
  }
  btn.setAttribute('aria-expanded', 'true');
  const box = Object.assign(document.createElement('div'), { className: 'trail muted', textContent: 'Loading…' });
  li.append(box);
  try {
    const ev = await api(`/api/bots/${encodeURIComponent(ip)}`);
    box.className = 'trail';
    box.innerHTML = ev.length
      ? `<ol>${ev.map((r) => `<li><span class="fw">${when(r.at)}</span> <span class="kind k-${esc(r.kind)}">${BK[r.kind] ?? esc(r.kind)}</span> ${esc(r.method)} ${where(r.host, r.path)}</li>`).join('')}</ol>`
      : '<span class="muted">No logged requests (logs keep 7 days).</span>';
  } catch (x) {
    box.innerHTML = `<span class="err">${esc(x.message)}</span>`;
  }
});

/* ---------- maze (live map of the labyrinth) ---------- */
// Every logged bot request is a step: the page it was served is a node, and since labyrinth pages are deterministic the
// server sends each page's 8 onward link ids, so a page reached through one of them is drawn as that page's child.
// One clock drives both modes: Live plays events LAG behind real time; Replay runs the last 24 h faster, then turns Live.
const LAG = 8000,
  STEP = 38,
  MZ = { all: [], i: 0, after: 0, clock: 0, speed: 1, nodes: new Map(), parent: new Map(), bots: new Map(), trails: [], box: null };
const strHash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
const flagOf = (cc) => (/^[A-Z]{2}$/.test(cc ?? '') ? String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '');
const still = matchMedia('(prefers-reduced-motion: reduce)');
let mzColors = {};
const readColors = () => {
  const cs = getComputedStyle(document.documentElement),
    v = (k) => cs.getPropertyValue(k).trim();
  mzColors = {
    fg: v('--fg'),
    muted: v('--muted'),
    line: v('--line'),
    card: v('--card'),
    trap: v('--danger'),
    maze: v('--c-maze'),
    flagged: v('--c-flag'),
    mono: v('--mono'),
  };
};
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColors);

function mzReset() {
  Object.assign(MZ, { i: 0, nodes: new Map(), parent: new Map(), bots: new Map(), trails: [], box: null });
  $('#maze-feed').innerHTML = '';
}
/** The node for an event's page, created on first visit: next to the page that linked to it, else as a new entrance. */
function mzNode(e, now) {
  let n = MZ.nodes.get(e.path);
  if (n) return n;
  const p = MZ.nodes.get(MZ.parent.get(e.path.slice(8))),
    h = strHash(e.path);
  if (p) {
    const ang = p.ang + (p.links.indexOf(e.path.slice(8)) - 3.5) * 0.3 + (((h % 100) - 50) / 50) * 0.08;
    n = { x: p.x + Math.cos(ang) * STEP, y: p.y + Math.sin(ang) * STEP, ang, depth: p.depth + 1, parent: p };
  } else {
    const ang = ((h % 3600) / 3600) * Math.PI * 2,
      r = 70 + ((h >>> 12) % 50);
    n = { x: Math.cos(ang) * r, y: Math.sin(ang) * r, ang, depth: 0, parent: null };
  }
  Object.assign(n, { path: e.path, title: e.title, kind: e.kind, links: e.links, born: now, hit: now, visits: 0 });
  for (const l of e.links) if (!MZ.parent.has(l)) MZ.parent.set(l, e.path);
  MZ.nodes.set(e.path, n);
  const b = MZ.box ?? { x0: n.x, x1: n.x, y0: n.y, y1: n.y };
  MZ.box = { x0: Math.min(b.x0, n.x), x1: Math.max(b.x1, n.x), y0: Math.min(b.y0, n.y), y1: Math.max(b.y1, n.y) };
  return n;
}
/** Plays one event: the bot (one per IP) walks to the page and reads it. animate = false builds the scene silently. */
function mzStep(e, animate) {
  const now = performance.now(),
    n = mzNode(e, now);
  n.visits++;
  n.hit = animate ? now : -1e9;
  let b = MZ.bots.get(e.ip);
  if (!b) {
    const far = 600; // new bots fly in from outside, along the entrance's direction
    b = { ip: e.ip, hue: strHash(e.ip) % 360, x: Math.cos(n.ang) * far, y: Math.sin(n.ang) * far, node: null, steps: 0, deepest: 0 };
    MZ.bots.set(e.ip, b);
  }
  if (b.node && b.node !== n) MZ.trails.push({ a: b.node, b: n, hue: b.hue, at: animate ? now : -1e9 });
  if (MZ.trails.length > 600) MZ.trails.splice(0, MZ.trails.length - 600);
  Object.assign(b, { fx: b.x, fy: b.y, t0: now, dur: animate && !still.matches ? 750 : 0, node: n, steps: b.steps + 1, deepest: Math.max(b.deepest, n.depth) });
  Object.assign(b, {
    at: e.at,
    country: e.country,
    ua: e.ua,
    family: e.family,
    total: e.total,
    host: e.host,
    kind: e.kind,
    bytes: e.bytes ?? 0,
    held: e.held ?? 0,
  });
  if (!animate) return;
  const what =
    e.kind === 'trap'
      ? `tripped ${where(e.host, e.path)}`
      : e.kind === 'flagged'
        ? `asked for ${where(e.host, e.path)}, got the maze`
        : n.parent
          ? `followed a link to “${esc(e.title)}” <span class="muted">depth ${n.depth}</span>`
          : `found the hidden link on ${esc(short(e.host))}: “${esc(e.title)}”`;
  const li = document.createElement('li');
  li.innerHTML = `<span class="fw">${new Date(e.at).toLocaleTimeString()}</span><i style="background:hsl(${b.hue} 75% 55%)"></i><span><button type="button" class="link-btn" data-watch="${esc(e.ip)}">${esc(e.ip)}</button> ${flagOf(e.country)} ${what}</span>`;
  const f = $('#maze-feed');
  f.prepend(li);
  while (f.children.length > 60) f.lastChild.remove();
}
function mzMode(speed) {
  for (const x of document.querySelectorAll('#maze-mode button')) x.setAttribute('aria-pressed', String(Number(x.dataset.s) === speed));
  mzReset();
  MZ.speed = speed;
  if (speed === 1) {
    // Live: everything already past is laid down at once, only new steps animate.
    MZ.clock = Date.now() - LAG;
    while (MZ.i < MZ.all.length && MZ.all[MZ.i].at <= MZ.clock) mzStep(MZ.all[MZ.i++], false);
  } else MZ.clock = (MZ.all[0]?.at ?? Date.now()) - 1000;
}
$('#maze-mode').addEventListener('click', (e) => {
  const s = Number(e.target.closest('button')?.dataset.s);
  if (s) mzMode(s);
});

async function mzPoll() {
  try {
    for (let more = true; more;) {
      const ev = await api(`/api/bots/maze?after=${MZ.after}`);
      MZ.all.push(...ev);
      if (ev.length) MZ.after = ev.at(-1).id;
      more = ev.length === 3000;
    }
    $('#maze-msg').textContent = '';
  } catch (x) {
    $('#maze-msg').textContent = x.message;
  }
}
let mzRaf = 0,
  mzTimer = 0,
  mzList = 0,
  mzLast = 0,
  cam = null;
async function loadMaze() {
  readColors();
  if (!MZ.after) {
    await mzPoll();
    mzMode(1);
  }
  clearInterval(mzTimer);
  mzTimer = setInterval(mzPoll, 5000);
  mzLast = performance.now();
  cancelAnimationFrame(mzRaf);
  mzRaf = requestAnimationFrame(mzFrame);
}

function mzFrame() {
  const t = performance.now(); // not the rAF timestamp: it can be earlier than the performance.now() steps were stamped with
  mzRaf = requestAnimationFrame(mzFrame);
  const dt = Math.min(100, t - mzLast);
  mzLast = t;
  // clock
  MZ.clock += dt * MZ.speed;
  const live = Date.now() - LAG;
  if (MZ.speed > 1) {
    const next = MZ.all[MZ.i];
    if (next && next.at - MZ.clock > 4000 * MZ.speed) MZ.clock = next.at - 500 * MZ.speed; // skip quiet hours
    if (MZ.clock >= live) {
      for (const x of document.querySelectorAll('#maze-mode button')) x.setAttribute('aria-pressed', String(x.dataset.s === '1'));
      MZ.speed = 1;
    }
  }
  if (MZ.speed === 1) MZ.clock = live;
  for (let k = 0; MZ.i < MZ.all.length && MZ.all[MZ.i].at <= MZ.clock && k < 40; k++) mzStep(MZ.all[MZ.i++], true);

  // canvas
  const cv = $('#maze-canvas'),
    dpr = devicePixelRatio || 1,
    W = cv.clientWidth,
    H = cv.clientHeight;
  if (!W) return; // another tab is showing: steps and the clock keep going, nothing to draw
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) Object.assign(cv, { width: Math.round(W * dpr), height: Math.round(H * dpr) });
  const g = cv.getContext('2d'),
    C = mzColors;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  // camera eases towards a fit of everything drawn so far
  const b = MZ.box ?? { x0: -100, x1: 100, y0: -100, y1: 100 },
    x0 = Math.min(b.x0, -130),
    x1 = Math.max(b.x1, 130),
    y0 = Math.min(b.y0, -130),
    y1 = Math.max(b.y1, 130);
  const want = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, s: Math.min(2.2, (W - 60) / (x1 - x0), (H - 60) / (y1 - y0)) };
  cam = cam && !still.matches ? { x: cam.x + (want.x - cam.x) * 0.05, y: cam.y + (want.y - cam.y) * 0.05, s: cam.s + (want.s - cam.s) * 0.05 } : want;
  const sx = (x) => W / 2 + (x - cam.x) * cam.s,
    sy = (y) => H / 2 + (y - cam.y) * cam.s,
    z = Math.max(0.6, Math.min(1.6, cam.s));

  // the core, where entrances ring
  g.strokeStyle = C.line;
  g.setLineDash([3, 5]);
  for (const r of [45, 125]) {
    g.beginPath();
    g.arc(sx(0), sy(0), r * cam.s, 0, Math.PI * 2);
    g.stroke();
  }
  g.setLineDash([]);
  // corridors
  g.lineWidth = 1;
  g.strokeStyle = C.line;
  g.beginPath();
  for (const n of MZ.nodes.values())
    if (n.parent) {
      g.moveTo(sx(n.parent.x), sy(n.parent.y));
      g.lineTo(sx(n.x), sy(n.y));
    }
  g.stroke();
  // fresh footprints, in the bot's colour, fading over 30 s
  g.lineWidth = 2.5 * z;
  for (const tr of MZ.trails) {
    const a = 1 - (t - tr.at) / 30000;
    if (a <= 0) continue;
    g.strokeStyle = `hsl(${tr.hue} 75% 55% / ${a * 0.8})`;
    g.beginPath();
    g.moveTo(sx(tr.a.x), sy(tr.a.y));
    g.lineTo(sx(tr.b.x), sy(tr.b.y));
    g.stroke();
  }
  // pages
  for (const n of MZ.nodes.values()) {
    const x = sx(n.x),
      y = sy(n.y),
      r = (n.kind === 'trap' ? 4.5 : 2.2 + Math.min(3, Math.log2(n.visits + 1) * 0.8)) * z,
      grow = Math.max(0, Math.min(1, (t - n.born) / 400));
    g.fillStyle = C[n.kind] ?? C.maze;
    g.beginPath();
    if (n.kind !== 'trap') g.arc(x, y, r * grow, 0, Math.PI * 2);
    else
      for (const [dx, dy] of [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ])
        g.lineTo(x + dx * r * grow, y + dy * r * grow);
    g.fill();
    const age = t - n.hit; // a page being read pulses and shows its title
    if (age < 2600) {
      g.strokeStyle = C[n.kind] ?? C.maze;
      g.globalAlpha = 1 - age / 2600;
      g.beginPath();
      g.arc(x, y, r + (age / 2600) * 22 * z, 0, Math.PI * 2);
      g.stroke();
      g.font = `${11 * Math.min(1.2, z)}px ${C.mono}`;
      g.fillStyle = C.fg;
      g.textAlign = 'center';
      g.fillText(n.kind === 'trap' || n.kind === 'flagged' ? n.path.slice(0, 40) : n.title, x, y - r - 8);
      g.globalAlpha = 1;
    }
  }
  // bots
  const recent = [];
  for (const bot of MZ.bots.values()) {
    const idle = MZ.clock - bot.at;
    if (idle > 600_000) continue; // gone quiet for 10 min of maze time: left (or out of logged requests)
    recent.push(bot);
    const p = bot.dur ? Math.max(0, Math.min(1, (t - bot.t0) / bot.dur)) : 1,
      e = 1 - (1 - p) ** 3;
    bot.x = bot.fx + (bot.node.x - bot.fx) * e;
    bot.y = bot.fy + (bot.node.y - bot.fy) * e;
    const x = sx(bot.x),
      y = sy(bot.y),
      fade = Math.max(0.25, 1 - idle / 600_000),
      col = `hsl(${bot.hue} 80% 58% / ${fade})`;
    Object.assign(bot, { sx: x, sy: y, drawn: t });
    g.shadowColor = col;
    g.shadowBlur = 12;
    g.fillStyle = col;
    g.beginPath();
    g.arc(x, y, 5 * z, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
    const reading = t - bot.t0 - bot.dur; // the labyrinth makes them wait 1.5-3 s per page
    if (p === 1 && reading < 2250 * Math.max(1, MZ.speed / 60) && !still.matches) {
      g.strokeStyle = col;
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(x, y, 9 * z, t / 180, t / 180 + Math.PI * 1.2);
      g.stroke();
    }
    g.font = `10px ${C.mono}`;
    g.fillStyle = C.muted;
    g.textAlign = 'left';
    g.fillText(`${flagOf(bot.country)} ${bot.ip}`, x + 8 * z, y + 12 * z);
  }
  // status
  g.font = `12px ${C.mono}`;
  g.textAlign = 'left';
  g.fillStyle = MZ.speed === 1 ? C.trap : C.muted;
  const head =
    MZ.speed === 1 ? '● LIVE' : `▶ REPLAY ×${MZ.speed}  ${new Date(MZ.clock).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`;
  g.fillText(head, 14, 22);
  g.fillStyle = C.muted;
  g.fillText(`${num(MZ.nodes.size)} pages mapped · ${recent.length} bot${recent.length === 1 ? '' : 's'} inside`, 14, 40);
  const all = [...MZ.bots.values()];
  g.fillText(`${size(all.reduce((a, b) => a + b.bytes, 0))} of junk fed · ${dur(all.reduce((a, b) => a + b.held, 0))} of their time`, 14, 58);
  if (!MZ.nodes.size) {
    g.textAlign = 'center';
    g.fillText(MZ.all.length ? 'Waiting for the next step…' : 'No bots in the last 24 hours.', W / 2, H / 2);
  }
  if (t - mzList > 1000) {
    mzList = t;
    mzBots(recent);
  }
}
// Clicking a bot on the map opens its inspector.
$('#maze-canvas').addEventListener('click', (e) => {
  const r = e.currentTarget.getBoundingClientRect(),
    x = e.clientX - r.left,
    y = e.clientY - r.top,
    now = performance.now();
  const hit = [...MZ.bots.values()]
    .filter((b) => now - b.drawn < 500 && Math.hypot(b.sx - x, b.sy - y) < 18)
    .sort((a, b) => Math.hypot(a.sx - x, a.sy - y) - Math.hypot(b.sx - x, b.sy - y))[0];
  if (hit) openInspector(hit.ip);
});
/** The side list of bots currently inside, refreshed once a second. */
function mzBots(list) {
  $('#maze-count').textContent = list.length;
  list.sort((a, b) => b.at - a.at);
  $('#maze-bots').innerHTML = list.length
    ? list
        .map(
          (b) =>
            `<li><i style="background:hsl(${b.hue} 75% 55%)"></i><span><button type="button" class="link-btn" data-watch="${esc(b.ip)}">${esc(b.ip)}</button> ${flagOf(b.country)} <b>${esc(b.family ?? '')}</b> <span class="kind k-${esc(b.kind)}">${BK[b.kind] ?? esc(b.kind)}</span> ${num(b.steps)} step${b.steps === 1 ? '' : 's'} here, depth ${b.deepest}${b.total ? `, ${num(b.total)} labyrinth pages all told` : ''}${b.bytes ? ` · ${size(b.bytes)} downloaded, held ${dur(b.held)}` : ''}<br><span class="muted small" title="${esc(b.ua ?? '')}">${esc((b.ua || '(no user agent)').slice(0, 90))}</span></span></li>`,
        )
        .join('')
    : '<li class="muted">Nobody inside right now.</li>';
}

/* ---------- bot inspector (one bot's requests, played back with the pages it was served) ---------- */
const FMT = { html: 'HTML', json: 'JSON', text: 'bait file' };
const GAP = 300_000, // idle gaps longer than this are collapsed on the strip and skipped in playback
  INS = { bot: null, steps: [], i: 0, timer: 0, pages: new Map() };
const dur = (ms) => (ms < 90_000 ? `${Math.round(ms / 1000)} s` : ms < 5_400_000 ? `${Math.round(ms / 60_000)} min` : `${(ms / 3_600_000).toFixed(1)} h`);
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-watch]');
  if (b) openInspector(b.dataset.watch);
});
async function openInspector(ip) {
  inspStop();
  $('#insp-msg').textContent = '';
  $('#insp-h').textContent = ip;
  if (!$('#insp').open) $('#insp').showModal();
  let d;
  try {
    d = await api(`/api/bots/timeline?ip=${encodeURIComponent(ip)}`);
  } catch (x) {
    $('#insp-msg').textContent = x.message;
    return;
  }
  // Which page linked to which: a step reached through a link on an earlier page is that page's child, one level deeper.
  const from = new Map();
  for (const [k, s] of d.steps.entries()) {
    const p = s.path.startsWith('/__maze/') ? from.get(s.path.slice(8)) : undefined;
    Object.assign(s, { n: k, parent: p, depth: p ? p.depth + 1 : 0, link: p ? p.links.indexOf(s.path.slice(8)) : -1, gap: k ? s.at - d.steps[k - 1].at : 0 });
    if (p && !p.next) p.next = s;
    for (const l of s.links) if (!from.has(l)) from.set(l, s);
  }
  Object.assign(INS, { bot: d.bot, steps: d.steps, i: 0 });
  // Pace while active: logged steps per minute, not counting idle gaps over 5 min.
  const b = d.bot,
    busy = d.steps.reduce((a, s) => a + (s.gap > GAP ? 0 : s.gap), 0),
    pace = busy > 0 ? ((d.steps.length - 1) / busy) * 60_000 : 0;
  $('#insp-h').innerHTML =
    `${esc(b.ip)} ${flagOf(b.country)} <span class="badge">${esc(b.family.name)}</span> <span class="muted small">${esc(b.family.type)}</span>`;
  $('#insp-sub').textContent = b.ua || '(no user agent)';
  $('#insp-kpis').innerHTML = [
    ['First seen', ago(b.first_at)],
    ['Last seen', ago(b.last_at)],
    ['Requests', `${num(b.hits)}${d.steps.length < b.hits ? ` (${num(d.steps.length)} logged)` : ''}`],
    ['Labyrinth pages', num(b.maze)],
    ['Deepest', d.steps.length ? `depth ${Math.max(...d.steps.map((s) => s.depth))}` : '—'],
    ['Held up', dur(b.held_ms)],
    ['Downloaded', size(b.bytes)],
    ['Filler read', `${num(b.words)} words`],
    ['Stayed', dur(b.last_at - b.first_at)],
    ['Pace', pace ? `${pace.toFixed(1)} pages/min` : '—'],
  ]
    .map(([k, v]) => `<div class="mini"><small>${k}</small><b>${esc(v)}</b></div>`)
    .join('');
  $('#insp-steps').innerHTML = d.steps
    .map(
      (s) =>
        `<li data-n="${s.n}"><button type="button"><span class="fw">${new Date(s.at).toLocaleTimeString()}</span> <span class="kind k-${esc(s.kind)}">${BK[s.kind] ?? esc(s.kind)}</span>${s.fmt !== 'html' ? ` <span class="muted small">${FMT[s.fmt] ?? '403'}</span>` : ''}<br>${
          s.kind === 'maze' ? `“${esc(s.title)}” <span class="muted">depth ${s.depth}</span>` : `<span class="mono">${esc(s.path)}</span>`
        }</button></li>`,
    )
    .join('');
  $('#insp-seek').max = String(Math.max(0, d.steps.length - 1));
  inspStrip();
  if (d.steps.length) inspGo(0);
  else $('#insp-note').textContent = 'No logged requests for this bot (logs keep 7 days).';
}
/** The traffic strip: one bar per request on a time axis, with idle gaps over 5 min squeezed to a dashed mark. */
function inspStrip() {
  const S = INS.steps,
    svg = $('#insp-strip'),
    W = svg.clientWidth || 800;
  let t = 0;
  for (const s of S) s.x = t += Math.min(s.gap, GAP) || 0;
  const k = (W - 8) / Math.max(1, t);
  svg.setAttribute('viewBox', `0 0 ${W} 46`);
  svg.innerHTML =
    S.map((s) => (s.gap > GAP ? `<line class="gap" x1="${4 + (s.x - GAP / 2) * k}" x2="${4 + (s.x - GAP / 2) * k}" y1="4" y2="42"/>` : '')).join('') +
    S.map(
      (s) => `<rect class="${esc(s.kind)}" x="${4 + s.x * k - 1}" y="${s.kind === 'maze' ? 14 : 6}" width="2" height="${s.kind === 'maze' ? 26 : 34}" rx="1"/>`,
    ).join('') +
    `<line class="cur" y1="0" y2="46"/>`;
  svg.dataset.k = k;
}
async function inspGo(i) {
  const S = INS.steps;
  if (!S.length) return;
  INS.i = i = Math.max(0, Math.min(S.length - 1, i));
  const s = S[i];
  $('#insp-seek').value = String(i);
  const cur = $('#insp-strip .cur'),
    x = 4 + s.x * Number($('#insp-strip').dataset.k);
  cur?.setAttribute('x1', x);
  cur?.setAttribute('x2', x);
  for (const li of $('#insp-steps').children) li.toggleAttribute('aria-current', false);
  const li = $(`#insp-steps li[data-n="${i}"]`);
  li?.setAttribute('aria-current', 'step');
  li?.scrollIntoView({ block: 'nearest' });
  $('#insp-pos').textContent = `Step ${num(i + 1)} of ${num(S.length)} · ${new Date(s.at).toLocaleString()}${i && s.gap ? ` · +${dur(s.gap)}` : ''}`;
  $('#insp-url').textContent = `${s.method} https://${s.host}${s.path}`;
  $('#insp-wait').textContent = `${FMT[s.fmt] ?? '403'} · held ${(s.delay / 1000).toFixed(1)} s · ${size(s.bytes)} · ${num(s.words)} words`;
  const how =
    s.kind === 'trap'
      ? `Tripped a honeypot asking for <span class="mono">${esc(s.path)}</span>, and got this page instead.`
      : s.kind === 'flagged'
        ? `Already flagged, asked for <span class="mono">${esc(s.path)}</span> and got this page instead of the site (a non-HTML request got a 403).`
        : s.parent
          ? `Got here from step ${s.parent.n + 1} by following link ${s.link + 1} of 8.`
          : `Came in through the hidden link on ${esc(short(s.host))}, or through a link on a page that wasn't logged.`;
  const nx = s.next,
    got =
      s.fmt === 'json'
        ? ' It asked for JSON (an API client or script), so it got a page of fake records.'
        : s.fmt === 'text'
          ? ` It got a bait file: a fake ${s.path.startsWith('/.git') ? 'git config' : '.env'} full of maze URLs.`
          : s.fmt
            ? ''
            : ' It asked for neither HTML nor JSON, so it got a 403.';
  $('#insp-note').innerHTML =
    `${how}${got} ${nx ? `Next it clicked the highlighted link (step ${nx.n + 1}, ${dur(nx.at - s.at)} later).` : 'It followed no link from this page that was logged.'}`;
  const key = `${s.fmt ?? 'none'} ${s.host} ${s.path}`;
  let html = INS.pages.get(key);
  if (!html) {
    try {
      html = (await api(`/api/bots/page?path=${encodeURIComponent(s.path)}&fmt=${s.fmt ?? 'none'}&host=${encodeURIComponent(s.host ?? '')}`)).html;
      INS.pages.set(key, html);
    } catch (x) {
      $('#insp-msg').textContent = x.message;
      return;
    }
  }
  if (INS.i !== i) return; // moved on while loading
  const next = nx && `<a href="/__maze/${nx.path.slice(8)}"`;
  $('#insp-frame').srcdoc = next
    ? html
        .replace('</head>', '<style>[data-next]{background:#ffe066;outline:3px solid #e8590c;outline-offset:2px}</style></head>')
        .replace(next, `${next} data-next`)
    : html;
}
function inspStop() {
  clearTimeout(INS.timer);
  INS.timer = 0;
  $('#insp-play').textContent = 'Play';
}
function inspPlay() {
  if (INS.timer) return inspStop();
  if (INS.i >= INS.steps.length - 1) inspGo(0);
  $('#insp-play').textContent = 'Pause';
  const tick = () => {
    const nx = INS.steps[INS.i + 1];
    if (!nx) return inspStop();
    const sp = Number($('#insp-speed').value);
    INS.timer = setTimeout(
      () => {
        inspGo(INS.i + 1);
        tick();
      },
      !sp || nx.gap > GAP ? 1000 : Math.max(80, nx.gap / sp),
    );
  };
  tick();
}
$('#insp-play').addEventListener('click', inspPlay);
$('#insp-speed').addEventListener('change', () => {
  if (!INS.timer) return;
  inspStop();
  inspPlay();
});
$('#insp-first').addEventListener('click', () => inspGo(0));
$('#insp-last').addEventListener('click', () => inspGo(INS.steps.length - 1));
$('#insp-prev').addEventListener('click', () => inspGo(INS.i - 1));
$('#insp-next').addEventListener('click', () => inspGo(INS.i + 1));
$('#insp-seek').addEventListener('input', (e) => inspGo(Number(e.target.value)));
$('#insp-steps').addEventListener('click', (e) => {
  const li = e.target.closest('li[data-n]');
  if (li) inspGo(Number(li.dataset.n));
});
$('#insp-strip').addEventListener('click', (e) => {
  const r = e.currentTarget.getBoundingClientRect(),
    x = ((e.clientX - r.left) / r.width) * Number(e.currentTarget.viewBox.baseVal.width),
    k = Number(e.currentTarget.dataset.k);
  let best = 0;
  for (const s of INS.steps) if (Math.abs(4 + s.x * k - x) < Math.abs(4 + INS.steps[best].x * k - x)) best = s.n;
  inspGo(best);
});
$('#insp').addEventListener('keydown', (e) => {
  if (e.target.matches('input, select')) return;
  if (e.key === ' ' && !e.target.matches('button')) {
    e.preventDefault();
    inspPlay();
  } else if (e.key === 'ArrowRight') inspGo(INS.i + 1);
  else if (e.key === 'ArrowLeft') inspGo(INS.i - 1);
});
// The frame may be same-origin (it runs no scripts: sandbox has no allow-scripts) so the clicked link can be scrolled into view.
$('#insp-frame').addEventListener('load', (e) => {
  const a = e.target.contentDocument?.querySelector('[data-next]');
  if (a) e.target.contentWindow.scrollTo(0, a.offsetTop - 120); // not scrollIntoView: that scrolls the admin page too
});
$('#insp-x').addEventListener('click', () => $('#insp').close());
$('#insp').addEventListener('close', inspStop);

// Data for all three tabs loads once; the map keeps polling, the stats refresh with their button.
const HASH = { map: '#map', stats: '#stats', bots: '#bots' };
mountTabs(HASH)(Object.keys(HASH).find((k) => HASH[k] === location.hash) ?? 'map');
loadMaze();
loadBots();
