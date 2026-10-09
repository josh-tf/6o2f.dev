import { $, api, esc, mountBar } from '/_/ui.js';
const meUser = await mountBar('Admin');

/* ---------- helpers ---------- */
const ago = (ms) => {
  if (!ms) return 'never';
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 90) return 'just now';
  const u = [
    [60, 'min'],
    [3600, 'h'],
    [86400, 'd'],
    [2592000, 'mo'],
    [31536000, 'y'],
  ];
  let out = `${Math.floor(s / 60)} min`;
  for (let i = 0; i < u.length - 1; i++) if (s >= u[i][0] && s < u[i + 1][0]) out = `${Math.floor(s / u[i][0])} ${u[i][1]}`;
  if (s >= 31536000) out = `${Math.floor(s / 31536000)} y`;
  return `${out} ago`;
};
const num = (n) => Number(n).toLocaleString('en-US');
const pct = (a, b) => (b ? `${(Math.round((a / b) * 1000) / 10).toFixed(1)}%` : '0%');

/* ---------- tabs ---------- */
const HASH = { users: '#users', content: '#content', bots: '#bots', maze: '#maze', controls: '#controls', stats: '#analytics', log: '#log' };
const LOAD = {
  content: () => loadContent(),
  bots: () => loadBots(),
  maze: () => loadMaze(),
  controls: () => loadControls(),
  stats: () => loadStats(),
  log: () => loadLog(true),
};
function showTab(t) {
  for (const b of document.querySelectorAll('.tabs [role=tab]')) {
    b.setAttribute('aria-selected', String(b.dataset.t === t));
    b.tabIndex = b.dataset.t === t ? 0 : -1;
  }
  for (const k of Object.keys(HASH)) $(`#p-${k}`).hidden = k !== t;
  try {
    history.replaceState(null, '', HASH[t]);
  } catch {}
  LOAD[t]?.();
}
document.querySelector('.tabs').addEventListener('click', (e) => {
  if (e.target.dataset.t) showTab(e.target.dataset.t);
});
// Arrow keys / Home / End move between tabs (WAI-ARIA tabs pattern, automatic activation).
document.querySelector('.tabs').addEventListener('keydown', (e) => {
  const tabs = [...document.querySelectorAll('.tabs [role=tab]')],
    i = tabs.indexOf(e.target);
  const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
  if (i < 0 || j === undefined) return;
  e.preventDefault();
  const next = tabs[(j + tabs.length) % tabs.length];
  showTab(next.dataset.t);
  next.focus();
});

/* ---------- users ---------- */
let TOOLS = [],
  USERS = [];
const chips = (names, selected) =>
  names.map((n) => `<label><input type="checkbox" value="${esc(n)}" ${selected.has(n) ? 'checked' : ''}>${esc(n)}</label>`).join('');
const picked = (root) => [...root.querySelectorAll('input[type=checkbox]:checked')].map((i) => i.value);
/** All locked tools ticked = '*' (every locked tool, including ones added later). */
const toolsValue = (root) => {
  const p = picked(root);
  return p.length === TOOLS.length ? '*' : p;
};

function userCard(u, pending) {
  const sel = new Set(u.tools === '*' ? TOOLS : u.tools ? u.tools.split(',') : []);
  const self = u.id === meUser?.id;
  const badges = [
    u.is_admin ? `<span class="badge admin">admin${u.permanent ? ' · permanent' : ''}</span>` : '',
    self ? '<span class="badge">you</span>' : '',
    u.suspended ? '<span class="badge warn">suspended</span>' : '',
    u.no_access ? '<span class="badge warn">no access</span>' : '',
  ].join('');
  const meta = `last login ${ago(u.last_login_at)} · ${num(u.logins ?? 0)} login${u.logins === 1 ? '' : 's'} · ${num(u.hits30)} request${u.hits30 === 1 ? '' : 's'} (30 days)${
    u.topTools?.length
      ? ' · ' +
        u.topTools
          .slice(0, 3)
          .map((t) => `${esc(t.tool)} ${num(t.n)}`)
          .join(', ')
      : ''
  }`;
  const acts = [
    `<button type="button" data-act="details" aria-expanded="false" aria-controls="det-${esc(u.id)}">Details</button>`,
    u.is_admin && !u.permanent && !self ? '<button type="button" data-act="demote">Remove admin</button>' : '',
    !u.is_admin ? '<button type="button" data-act="promote">Make admin</button>' : '',
    !u.is_admin ? '<button type="button" class="danger" data-act="remove">Remove</button>' : '',
  ].join('');
  const body = u.is_admin
    ? '<p class="muted" style="margin:0">Admins can use every tool.</p>'
    : `
    <fieldset class="tools"><legend>Tools</legend><div class="toolsbar"><button type="button" data-act="all">All</button><button type="button" data-act="none">None</button></div>
    <div class="chips">${chips(TOOLS, sel)}</div></fieldset>
    <div class="savebar">${pending ? '<button type="button" class="primary" data-act="approve">Approve all tools</button>' : ''}<button type="button" class="${pending ? '' : 'primary'}" data-act="save" disabled>Save</button><span class="st" role="status"></span></div>`;
  return `<div class="card user" data-id="${esc(u.id)}" data-orig="${esc(JSON.stringify(u.tools === '*' ? '*' : [...sel].sort()))}">
    <div class="hd">${u.avatarUrl ? `<img src="${esc(u.avatarUrl)}" alt="">` : '<span class="ph"></span>'}
      <div class="who"><div class="nm">${esc(u.name ?? 'Not signed in yet')} ${badges}</div><div class="mono muted">${esc(u.id)}</div><div class="meta">${meta}</div></div>
      <div class="acts">${acts}</div></div><div class="det" id="det-${esc(u.id)}" hidden></div>${body}</div>`;
}

async function loadUsers() {
  const d = await api('/api/users');
  TOOLS = d.tools;
  USERS = d.users;
  if (!$('#addtools input')) $('#addtools').innerHTML = chips(TOOLS, new Set(TOOLS));
  const pending = USERS.filter((u) => u.no_access),
    rest = USERS.filter((u) => !u.no_access);
  $('#pending').hidden = !pending.length;
  $('#pcount').textContent = pending.length;
  $('#pendlist').innerHTML = pending.map((u) => userCard(u, true)).join('');
  $('#pending').classList.add('pending');
  $('#ucount').textContent = rest.length;
  $('#users').innerHTML = rest.map((u) => userCard(u, false)).join('');
}

const normalised = (card) => {
  const v = toolsValue(card);
  return v === '*' ? '*' : [...v].sort();
};
function updateDirty(card) {
  const save = card.querySelector('[data-act=save]');
  if (!save) return;
  save.disabled = JSON.stringify(normalised(card)) === card.dataset.orig;
  const st = card.querySelector('.st');
  if (st && !save.disabled) {
    st.textContent = 'Unsaved changes';
    st.className = 'st';
  }
}
const flash = (card, text, cls) => {
  const st = card.querySelector('.st');
  if (st) {
    st.textContent = text;
    st.className = `st ${cls}`;
  }
};

async function saveTools(card, value) {
  try {
    await api(`/api/users/${card.dataset.id}/tools`, { method: 'PUT', body: { tools: value } });
    await loadUsers();
    const fresh = document.querySelector(`.user[data-id="${CSS.escape(card.dataset.id)}"]`);
    if (fresh) flash(fresh, 'Saved ✓', 'ok');
  } catch (x) {
    flash(card, x.message, 'bad');
  }
}

document.addEventListener('change', (e) => {
  const card = e.target.closest('.user');
  if (card && e.target.type === 'checkbox') updateDirty(card);
});
document.addEventListener('click', async (e) => {
  const all = e.target.closest('[data-all]'),
    none = e.target.closest('[data-none]');
  if (all || none) {
    const root = $((all ?? none).dataset.all ?? (all ?? none).dataset.none);
    root.querySelectorAll('input[type=checkbox]').forEach((i) => (i.checked = !!all));
    return;
  }
  const act = e.target.closest('[data-act]');
  const card = e.target.closest('.user');
  if (!act || !card) return;
  const a = act.dataset.act,
    id = card.dataset.id;
  if (a === 'details') return toggleDetails(card, act);
  if (a === 'signout' || a === 'suspend' || a === 'unsuspend' || a === 'revoke') return userAction(card, a, act);
  if (a === 'all' || a === 'none') {
    card.querySelectorAll('.chips input').forEach((i) => (i.checked = a === 'all'));
    updateDirty(card);
  } else if (a === 'save') await saveTools(card, toolsValue(card));
  else if (a === 'approve') await saveTools(card, '*');
  else if (a === 'promote' || a === 'demote') {
    $('#umsg').textContent = '';
    try {
      await api(`/api/users/${id}/admin`, { method: 'PUT', body: { admin: a === 'promote' } });
      await loadUsers();
    } catch (x) {
      $('#umsg').textContent = x.message;
    }
  } else if (a === 'remove') {
    $('#umsg').textContent = '';
    if (act.dataset.sure) {
      try {
        await api(`/api/users/${id}`, { method: 'DELETE' });
        await loadUsers();
      } catch (x) {
        $('#umsg').textContent = x.message;
      }
    } else {
      act.dataset.sure = '1';
      act.textContent = 'Click again to remove';
      setTimeout(() => {
        act.textContent = 'Remove';
        delete act.dataset.sure;
      }, 3000);
    }
  }
});
$('#add').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#msg').textContent = '';
  $('#addok').textContent = '';
  const id = $('#uid').value.trim();
  try {
    await api('/api/users', { method: 'POST', body: { id, tools: toolsValue($('#addtools')) } });
    $('#uid').value = '';
    await loadUsers();
    $('#addok').textContent = `Added ${id}.`;
  } catch (x) {
    $('#msg').textContent = x.message;
  }
});

const bytes = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
async function toggleDetails(card, btn) {
  const det = card.querySelector('.det'),
    open = det.hidden;
  det.hidden = !open;
  btn.setAttribute('aria-expanded', String(open));
  if (open) await renderDetails(card);
}
async function renderDetails(card) {
  const det = card.querySelector('.det'),
    id = card.dataset.id,
    u = USERS.find((x) => x.id === id);
  det.innerHTML = '<p class="muted">Loading…</p>';
  let d;
  try {
    d = await api(`/api/users/${id}`);
  } catch (x) {
    det.innerHTML = `<p class="err">${esc(x.message)}</p>`;
    return;
  }
  const st = d.storage,
    self = id === meUser?.id;
  const store = [
    ['Drop files', st.drop.n ? `${num(st.drop.n)} · ${bytes(st.drop.bytes)}` : '0'],
    ['Stash keys', st.stash.n ? `${num(st.stash.n)} · ${bytes(st.stash.bytes)}` : '0'],
    ['Pastes', st.pastes],
    ['Short links', st.links],
    ['Polls', st.polls],
    ['Countdowns', st.countdowns],
    ['Uptime monitors', st.monitors],
    ['Webhook endpoints', st.hooks],
    ['Feeds', st.feeds],
    ['AI requests today', st.aiToday],
  ];
  det.innerHTML = `<div class="detgrid">
    <section><h4>Stored</h4><dl class="kv">${store.map(([k, v]) => `<dt>${k}</dt><dd>${typeof v === 'number' ? num(v) : esc(v)}</dd>`).join('')}</dl></section>
    <section><h4>Activity, 30 days</h4>${d.activity.length ? bars(d.activity.map((t) => ({ key: t.tool, n: t.n }))) : '<p class="empty">No signed-in requests.</p>'}</section>
    <section><h4>API tokens</h4>${d.tokens.length ? `<ul class="toks">${d.tokens.map((t) => `<li><span><b>${esc(t.name)}</b> <span class="muted">created ${ago(t.created_at)}, used ${ago(t.last_used_at)}</span></span><button type="button" class="danger" data-act="revoke" data-tid="${esc(t.id)}">Revoke</button></li>`).join('')}</ul>` : '<p class="empty">No tokens.</p>'}</section>
  </div>
  <div class="savebar"><button type="button" data-act="signout">Sign out everywhere</button>${!u?.is_admin && !self ? (u?.suspended ? '<button type="button" data-act="unsuspend">Unsuspend</button>' : '<button type="button" class="danger" data-act="suspend">Suspend</button>') : ''}<span class="st" role="status"></span></div>`;
}
async function userAction(card, a, btn) {
  const id = card.dataset.id,
    st = () => card.querySelector('.det .st');
  if ((a === 'suspend' || a === 'revoke') && !btn.dataset.sure) {
    btn.dataset.sure = '1';
    const t = btn.textContent;
    btn.textContent = 'Click again to confirm';
    setTimeout(() => {
      btn.textContent = t;
      delete btn.dataset.sure;
    }, 3000);
    return;
  }
  try {
    if (a === 'signout') await api(`/api/users/${id}/signout`, { method: 'POST' });
    else if (a === 'revoke') await api(`/api/users/${id}/tokens/${btn.dataset.tid}`, { method: 'DELETE' });
    else await api(`/api/users/${id}/suspend`, { method: 'PUT', body: { suspended: a === 'suspend' } });
    if (a === 'suspend' || a === 'unsuspend') {
      await loadUsers();
      const fresh = document.querySelector(`.user[data-id="${CSS.escape(id)}"]`);
      if (fresh) {
        await toggleDetails(fresh, fresh.querySelector('[data-act=details]'));
        fresh.querySelector('.det .st').textContent = a === 'suspend' ? 'Suspended and signed out ✓' : 'Unsuspended ✓';
      }
      return;
    }
    await renderDetails(card);
    const s2 = st();
    if (s2) {
      s2.textContent = a === 'signout' ? 'Signed out on every device ✓' : 'Token revoked ✓';
      s2.className = 'st ok';
    }
  } catch (x) {
    const s2 = st();
    if (s2) {
      s2.textContent = x.message;
      s2.className = 'st bad';
    }
  }
}

/* ---------- content (moderation) ---------- */
const KIND = { link: 'Short link', paste: 'Paste', poll: 'Poll', countdown: 'Countdown', drop: 'Drop file', hook: 'Webhook' };
let CONTENT = [];
const when = (ms) =>
  ms ? `<time datetime="${new Date(ms).toISOString()}" title="${esc(new Date(ms).toLocaleString())}">${ago(ms).replace(' ago', '')}</time>` : '—';
const until = (ms) => {
  if (!ms) return '<span class="muted">never</span>';
  const d = ms - Date.now();
  return d <= 0
    ? '<span class="muted">expired</span>'
    : `<time datetime="${new Date(ms).toISOString()}" title="${esc(new Date(ms).toLocaleString())}">in ${ago(Date.now() - d).replace(' ago', '')}</time>`;
};
async function loadContent() {
  $('#cmsg').textContent = '';
  $('#ccount').textContent = 'Loading…';
  try {
    const d = await api('/api/content');
    CONTENT = d.items;
    $('#ccount').dataset.trunc = d.truncated ? '1' : '';
  } catch (x) {
    $('#cmsg').textContent = x.message;
    $('#ccount').textContent = '';
    return;
  }
  drawContent();
}
function drawContent() {
  const q = $('#cq').value.trim().toLowerCase(),
    k = $('#ck').value;
  const rows = CONTENT.filter((i) => (!k || i.kind === k) && (!q || `${i.title} ${i.url} ${i.ownerName ?? ''} ${i.owner}`.toLowerCase().includes(q)));
  $('#ccount').textContent = `${num(rows.length)} of ${num(CONTENT.length)} items${$('#ccount').dataset.trunc ? ' (KV lists capped at 1,000 keys)' : ''}`;
  $('#ctab tbody').innerHTML = rows.length
    ? rows
        .map(
          (i) => `<tr data-kind="${esc(i.kind)}" data-id="${esc(i.id)}" data-owner="${esc(i.owner)}">
    <td><span class="kind k-${esc(i.kind)}">${KIND[i.kind] ?? esc(i.kind)}</span></td>
    <td class="ctitle"><a href="${esc(i.url)}" target="_blank" rel="noopener noreferrer">${esc(i.title || i.id)}</a><span class="mono muted small">${esc(i.url.replace(/^https:\/\//, ''))}${i.size ? ` · ${bytes(i.size)}` : ''}</span></td>
    <td data-label="by">${esc(i.ownerName ?? i.owner)}</td><td data-label="created">${when(i.created)}</td><td data-label="expires">${until(i.expires)}</td>
    <td class="act"><button type="button" class="danger" data-del>Delete</button></td></tr>`,
        )
        .join('')
    : `<tr><td colspan="6" class="empty">${CONTENT.length ? 'Nothing matches.' : 'Nothing published yet.'}</td></tr>`;
}
$('#cq').addEventListener('input', drawContent);
$('#ck').addEventListener('change', drawContent);
$('#creload').addEventListener('click', loadContent);
$('#ctab').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-del]');
  if (!b) return;
  const tr = b.closest('tr');
  if (!b.dataset.sure) {
    b.dataset.sure = '1';
    b.textContent = 'Confirm';
    setTimeout(() => {
      b.textContent = 'Delete';
      delete b.dataset.sure;
    }, 3000);
    return;
  }
  try {
    await api(`/api/content/${tr.dataset.kind}/${encodeURIComponent(tr.dataset.id)}?owner=${encodeURIComponent(tr.dataset.owner)}`, { method: 'DELETE' });
    CONTENT = CONTENT.filter((i) => !(i.kind === tr.dataset.kind && i.id === tr.dataset.id));
    drawContent();
    $('#ccount').textContent += ' · deleted ✓';
  } catch (x) {
    $('#cmsg').textContent = x.message;
  }
});

/* ---------- controls ---------- */
let CTL = null;
const STATES = [
  ['on', 'On'],
  ['maintenance', 'Maintenance'],
  ['off', 'Off'],
];
async function loadControls() {
  try {
    CTL = await api('/api/settings');
  } catch (x) {
    $('#tmsg').textContent = x.message;
    return;
  }
  const dv = CTL.defaultTools,
    mode = dv === '' ? 'none' : dv === '*' ? 'all' : 'some';
  document.querySelector(`input[name=def][value=${mode}]`).checked = true;
  const sel = new Set(mode === 'some' ? dv.split(',') : []);
  $('#defchips').innerHTML = chips(CTL.grantable, sel);
  $('#defchips').hidden = mode !== 'some';
  $('#defsave').disabled = true;
  $('#defst').textContent = '';
  drawTools();
}
function drawTools() {
  const q = $('#tq').value.trim().toLowerCase(),
    rows = CTL.tools.filter((t) => !q || `${t.name} ${t.title}`.toLowerCase().includes(q));
  const off = CTL.tools.filter((t) => t.state !== 'on');
  $('#tsum').textContent = off.length ? `${off.length} not on: ${off.map((t) => `${t.title} (${t.state})`).join(', ')}` : 'All tools are on.';
  $('#ttab tbody').innerHTML = rows
    .map(
      (
        t,
      ) => `<tr data-tool="${esc(t.name)}"${t.state !== 'on' ? ' class="notOn"' : ''}><th scope="row">${esc(t.title)} <span class="mono muted small">${esc(t.name)}</span></th><td>${t.public ? 'public' : 'sign-in'}</td>
    <td><div class="seg" role="radiogroup" aria-label="${esc(t.title)} state">${STATES.map(([v, l]) => `<button type="button" role="radio" data-state="${v}" aria-checked="${t.state === v}" tabindex="${t.state === v ? 0 : -1}">${l}</button>`).join('')}</div></td></tr>`,
    )
    .join('');
}
$('#tq').addEventListener('input', drawTools);
async function setState(tr, btn) {
  const tool = tr.dataset.tool,
    state = btn.dataset.state,
    t = CTL.tools.find((x) => x.name === tool);
  if (!t || t.state === state) return;
  $('#tmsg').textContent = '';
  try {
    await api('/api/settings', { method: 'PUT', body: { tool, state } });
    t.state = state;
    drawTools();
    document.querySelector(`#ttab tr[data-tool="${CSS.escape(tool)}"] [data-state="${state}"]`)?.focus();
  } catch (x) {
    $('#tmsg').textContent = x.message;
  }
}
$('#ttab').addEventListener('click', (e) => {
  const b = e.target.closest('[data-state]');
  if (b) setState(b.closest('tr'), b);
});
// Radio-group keys: arrows move and select.
$('#ttab').addEventListener('keydown', (e) => {
  const b = e.target.closest('[data-state]');
  if (!b) return;
  const bs = [...b.parentElement.children],
    i = bs.indexOf(b),
    j = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1 }[e.key];
  if (j === undefined) return;
  e.preventDefault();
  setState(b.closest('tr'), bs[(j + bs.length) % bs.length]);
});
const defValue = () => {
  const m = document.querySelector('input[name=def]:checked')?.value;
  return m === 'none' ? '' : m === 'all' ? '*' : picked($('#defchips'));
};
$('#defform').addEventListener('change', (e) => {
  if (e.target.name === 'def') $('#defchips').hidden = e.target.value !== 'some';
  const v = defValue(),
    cur = CTL.defaultTools;
  $('#defsave').disabled =
    JSON.stringify(Array.isArray(v) ? v.sort().join(',') : v) === JSON.stringify(cur === '' || cur === '*' ? cur : cur.split(',').sort().join(','));
  $('#defst').textContent = $('#defsave').disabled ? '' : 'Unsaved changes';
  $('#defst').className = 'st';
});
$('#defform').addEventListener('submit', async (e) => {
  e.preventDefault();
  const v = defValue();
  if (Array.isArray(v) && !v.length) {
    $('#defst').textContent = 'Pick at least one tool, or choose "Nothing yet".';
    $('#defst').className = 'st bad';
    return;
  }
  try {
    await api('/api/settings', { method: 'PUT', body: { defaultTools: v } });
    await loadControls();
    $('#defst').textContent = 'Saved ✓';
    $('#defst').className = 'st ok';
  } catch (x) {
    $('#defst').textContent = x.message;
    $('#defst').className = 'st bad';
  }
});

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
  const secs = d.maze.pages * 2.25;
  $('#lkpis').innerHTML = [
    ['Crawlers', d.maze.crawlers],
    ['Pages served', d.maze.pages],
    ['Deepest crawl', d.maze.deepest ? `${num(d.maze.deepest)} page${d.maze.deepest === 1 ? '' : 's'}` : '—'],
    ['Their time wasted', secs < 90 ? `~${Math.round(secs)} s` : `~${Math.round(secs / 60)} min`],
  ]
    .map(([k, v]) => `<div class="mini"><small>${k}</small><b>${typeof v === 'number' ? num(v) : esc(v)}</b></div>`)
    .join('');
  $('#lcrawl').innerHTML = crawlers.length
    ? bars(
        crawlers.slice(0, 8).map((r) => ({ key: `${r.ip} ${r.country ?? ''}`, n: r.maze })),
        '',
      ) + '<p class="muted small">Pages each crawler walked through. Real browsers never see the hidden link, so every one of these ignored robots.txt.</p>'
    : '<p class="empty">Nobody has followed the hidden link yet.</p>';
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
  Object.assign(b, { at: e.at, country: e.country, ua: e.ua, total: e.total, host: e.host, kind: e.kind });
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
  if ($('#p-maze').hidden) return clearInterval(mzTimer); // tab left: stop drawing and polling
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
            `<li><i style="background:hsl(${b.hue} 75% 55%)"></i><span><button type="button" class="link-btn" data-watch="${esc(b.ip)}">${esc(b.ip)}</button> ${flagOf(b.country)} <span class="kind k-${esc(b.kind)}">${BK[b.kind] ?? esc(b.kind)}</span> ${num(b.steps)} step${b.steps === 1 ? '' : 's'} here, depth ${b.deepest}${b.total ? `, ${num(b.total)} labyrinth pages all told` : ''}<br><span class="muted small" title="${esc(b.ua ?? '')}">${esc((b.ua || '(no user agent)').slice(0, 90))}</span></span></li>`,
        )
        .join('')
    : '<li class="muted">Nobody inside right now.</li>';
}

/* ---------- bot inspector (one bot's requests, played back with the pages it was served) ---------- */
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
  const b = d.bot,
    wasted = d.steps.reduce((a, s) => a + s.delay, 0);
  $('#insp-h').innerHTML = `${esc(b.ip)} ${flagOf(b.country)}`;
  $('#insp-sub').textContent = b.ua || '(no user agent)';
  $('#insp-kpis').innerHTML = [
    ['First seen', ago(b.first_at)],
    ['Last seen', ago(b.last_at)],
    ['Requests', `${num(b.hits)}${d.steps.length < b.hits ? ` (${num(d.steps.length)} logged)` : ''}`],
    ['Labyrinth pages', num(b.maze)],
    ['Deepest', d.steps.length ? `depth ${Math.max(...d.steps.map((s) => s.depth))}` : '—'],
    ['Made to wait', `~${dur(wasted)}${d.steps.length < b.hits ? '+' : ''}`],
  ]
    .map(([k, v]) => `<div class="mini"><small>${k}</small><b>${esc(v)}</b></div>`)
    .join('');
  $('#insp-steps').innerHTML = d.steps
    .map(
      (s) =>
        `<li data-n="${s.n}"><button type="button"><span class="fw">${new Date(s.at).toLocaleTimeString()}</span> <span class="kind k-${esc(s.kind)}">${BK[s.kind] ?? esc(s.kind)}</span><br>${
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
  $('#insp-wait').textContent = `held ${(s.delay / 1000).toFixed(1)} s`;
  const how =
    s.kind === 'trap'
      ? `Tripped a honeypot asking for <span class="mono">${esc(s.path)}</span>, and got this page instead.`
      : s.kind === 'flagged'
        ? `Already flagged, asked for <span class="mono">${esc(s.path)}</span> and got this page instead of the site (a non-HTML request got a 403).`
        : s.parent
          ? `Got here from step ${s.parent.n + 1} by following link ${s.link + 1} of 8.`
          : `Came in through the hidden link on ${esc(short(s.host))}, or through a link on a page that wasn't logged.`;
  const nx = s.next;
  $('#insp-note').innerHTML =
    `${how} ${nx ? `Next it clicked the highlighted link (step ${nx.n + 1}, ${dur(nx.at - s.at)} later).` : 'It followed no link from this page that was logged.'}`;
  let html = INS.pages.get(s.path);
  if (!html) {
    try {
      html = (await api(`/api/bots/page?path=${encodeURIComponent(s.path)}`)).html;
      INS.pages.set(s.path, html);
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

/* ---------- audit log ---------- */
const ACTIONS = {
  'user.add': 'Added user',
  'user.tools': 'Changed tools',
  'user.promote': 'Made admin',
  'user.demote': 'Removed admin',
  'user.delete': 'Deleted user',
  'user.suspend': 'Suspended',
  'user.unsuspend': 'Unsuspended',
  'user.signout': 'Signed out everywhere',
  'token.revoke': 'Revoked token',
  'tool.state': 'Tool state',
  'settings.default_tools': 'New sign-in access',
  'content.delete': 'Deleted content',
  'guard.unflag': 'Unflagged IP',
};
let logOldest = null;
const detailText = (a, d) => {
  if (!d) return '';
  try {
    const o = JSON.parse(d);
    if (a === 'tool.state') return o.state;
    if (a === 'content.delete') return `${KIND[o.kind] ?? o.kind} ${o.id}`;
    if (a === 'guard.unflag') return o.ip;
    if (o.tools !== undefined) return o.tools === '' ? 'none (wait for approval)' : o.tools === '*' ? 'all locked tools' : [].concat(o.tools).join(', ');
    return d;
  } catch {
    return d;
  }
};
async function loadLog(reset) {
  if (reset) {
    logOldest = null;
    $('#ltab tbody').innerHTML = '';
  }
  let rows;
  try {
    rows = await api(`/api/log${logOldest ? `?before=${logOldest}` : ''}`);
  } catch (x) {
    $('#ltab tbody').innerHTML = `<tr><td colspan="5" class="err">${esc(x.message)}</td></tr>`;
    return;
  }
  if (rows.length) logOldest = rows.at(-1).id;
  $('#ltab tbody').insertAdjacentHTML(
    'beforeend',
    rows
      .map(
        (r) =>
          `<tr><td>${when(r.at)}</td><td>${esc(r.admin_name ?? r.admin_id)}</td><td>${esc(ACTIONS[r.action] ?? r.action)}</td><td>${esc(r.target_name ?? r.target ?? '—')}</td><td class="muted">${esc(detailText(r.action, r.detail))}</td></tr>`,
      )
      .join(''),
  );
  if (reset && !rows.length) $('#ltab tbody').innerHTML = '<tr><td colspan="5" class="empty">No admin actions yet.</td></tr>';
  $('#lmore').hidden = rows.length < 100;
}
$('#lmore').addEventListener('click', () => loadLog(false));

/* ---------- analytics ---------- */
let days = 30;
const bars = (items, empty = 'No data yet.') => {
  if (!items.length) return `<p class="empty">${empty}</p>`;
  const max = Math.max(...items.map((i) => i.n)),
    tot = items.reduce((a, i) => a + i.n, 0);
  return items
    .map(
      (i) =>
        `<div class="brow"><span>${esc(i.key)}</span><span class="tr"><i style="width:${Math.max(2, (i.n / max) * 100)}%"></i></span><span class="v">${num(i.n)} · ${pct(i.n, tot)}</span></div>`,
    )
    .join('');
};
function chart(daily) {
  const W = 640,
    H = 170,
    L = 34,
    B = 20,
    T = 8,
    w = W - L - 4,
    h = H - B - T;
  const maxH = Math.max(1, ...daily.map((d) => d.hits)),
    nice = (m) => {
      const p = 10 ** Math.floor(Math.log10(m));
      return Math.ceil(m / p) * p;
    },
    top = nice(maxH);
  const bw = w / daily.length,
    x = (i) => L + i * bw,
    y = (v) => T + h - (v / top) * h;
  const grid = [0, 0.5, 1]
    .map(
      (f) =>
        `<line class="grid" x1="${L}" x2="${W - 4}" y1="${y(top * f)}" y2="${y(top * f)}"/><text x="${L - 4}" y="${y(top * f) + 3}" text-anchor="end">${num(Math.round(top * f))}</text>`,
    )
    .join('');
  const rects = daily
    .map(
      (d, i) =>
        `<rect class="bar1" x="${x(i) + 1}" y="${y(d.hits)}" width="${Math.max(1, bw - 2)}" height="${Math.max(0, T + h - y(d.hits))}"><title>${d.day}: ${num(d.hits)} requests, ${num(d.visitors)} visitors, ${num(d.errors)} errors</title></rect>${d.errors ? `<rect class="err3" x="${x(i) + 1}" y="${T + h - 3}" width="${Math.max(1, bw - 2)}" height="3"/>` : ''}`,
    )
    .join('');
  const line = `<polyline class="line2" points="${daily.map((d, i) => `${x(i) + bw / 2},${y(Math.min(d.visitors, top))}`).join(' ')}"/>`;
  const step = Math.ceil(daily.length / 6),
    ticks = daily
      .map((d, i) => (i % step === 0 || i === daily.length - 1 ? `<text x="${x(i) + bw / 2}" y="${H - 5}" text-anchor="middle">${d.day.slice(5)}</text>` : ''))
      .join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Requests and visitors per day for the last ${daily.length} days">${grid}${rects}${line}${ticks}</svg>`;
}
/** Stacked daily bars. series: [{label, cls, vals}] (one value per label). Colours come from CSS classes, so both themes work. */
function stacked(labels, series, aria) {
  const W = 640,
    H = 180,
    L = 34,
    B = 22,
    T = 8,
    w = W - L - 4,
    h = H - B - T;
  const tot = labels.map((_, i) => series.reduce((a, s) => a + s.vals[i], 0)),
    max = Math.max(1, ...tot);
  const nice = (m) => {
      const p = 10 ** Math.floor(Math.log10(m));
      return Math.ceil(m / p) * p;
    },
    top = nice(max);
  const bw = w / labels.length,
    y = (v) => T + h - (v / top) * h;
  const grid = [0, 0.5, 1]
    .map(
      (f) =>
        `<line class="grid" x1="${L}" x2="${W - 4}" y1="${y(top * f)}" y2="${y(top * f)}"/><text x="${L - 4}" y="${y(top * f) + 3}" text-anchor="end">${num(Math.round(top * f))}</text>`,
    )
    .join('');
  const cols = labels
    .map((lab, i) => {
      let acc = 0;
      const x = L + i * bw + bw * 0.18,
        bwi = bw * 0.64;
      const segs = series
        .map((s) => {
          const v = s.vals[i];
          if (!v) return '';
          const y0 = y(acc),
            y1 = y(acc + v);
          acc += v;
          return `<rect class="${s.cls}" x="${x}" y="${y1}" width="${bwi}" height="${Math.max(1, y0 - y1)}" rx="2"><title>${esc(lab)}: ${num(v)} ${esc(s.label)}</title></rect>`;
        })
        .join('');
      return `${segs}<text x="${x + bwi / 2}" y="${H - 6}" text-anchor="middle">${esc(lab)}</text>${tot[i] ? `<text class="tot" x="${x + bwi / 2}" y="${y(tot[i]) - 4}" text-anchor="middle">${num(tot[i])}</text>` : ''}`;
    })
    .join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(aria)}">${grid}${cols}</svg>`;
}
/** Top n items, the rest folded into one "Other" (merged with an existing "Other"/"other" item). */
function topN(items, n) {
  const isOther = (i) => i.key.toLowerCase() === 'other';
  const named = items.filter((i) => !isOther(i)),
    top = named.slice(0, n);
  const rest = items.reduce((a, i) => a + i.n, 0) - top.reduce((a, i) => a + i.n, 0);
  return rest ? [...top, { key: 'Other', n: rest }] : top;
}
/** Donut with a legend: for shares of a whole (browsers, devices). */
function donut(items, empty = 'No data yet.') {
  const tot = items.reduce((a, i) => a + i.n, 0);
  if (!tot) return `<p class="empty">${empty}</p>`;
  const R = 42,
    C = 2 * Math.PI * R;
  let off = 0;
  const parts = topN(items, 5);
  const arcs = parts
    .map((p, i) => {
      const len = (p.n / tot) * C,
        a = `<circle class="d${i}" r="${R}" cx="60" cy="60" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}"><title>${esc(p.key)}: ${num(p.n)} (${pct(p.n, tot)})</title></circle>`;
      off += len;
      return a;
    })
    .join('');
  return `<div class="donut"><svg viewBox="0 0 120 120" role="img" aria-label="${esc(parts.map((p) => `${p.key} ${pct(p.n, tot)}`).join(', '))}"><g transform="rotate(-90 60 60)">${arcs}</g><text x="60" y="58" text-anchor="middle" class="dt">${num(tot)}</text><text x="60" y="72" text-anchor="middle" class="ds">total</text></svg>
    <ul>${parts.map((p, i) => `<li><i class="d${i}"></i><span>${esc(p.key)}</span><b>${pct(p.n, tot)}</b></li>`).join('')}</ul></div>`;
}
const spark = (series) => {
  const m = Math.max(1, ...series),
    n = series.length;
  return `<svg class="spark" viewBox="0 0 90 22" aria-hidden="true"><polyline points="${series.map((v, i) => `${(i / Math.max(1, n - 1)) * 90},${21 - (v / m) * 20}`).join(' ')}"/></svg>`;
};

let STATS = null,
  detailTool = null;
/** Change vs the previous period. good = which direction is good news (up for traffic, down for errors and latency). */
const delta = (cur, prev, good = 1) => {
  if (prev === null || prev === undefined) return '';
  if (!prev) return cur ? '<em class="dl">new</em>' : '';
  const ch = (cur - prev) / prev,
    cls = Math.abs(ch) < 0.005 ? '' : ch * good > 0 ? 'up' : 'down';
  return `<em class="dl ${cls}" title="Previous ${days} days: ${num(prev)}">${ch > 0 ? '▲' : ch < 0 ? '▼' : ''} ${Math.abs(Math.round(ch * 1000) / 10)}%</em>`;
};
async function loadStats() {
  let d;
  try {
    d = await api(`/api/stats?days=${days}`);
  } catch (x) {
    $('#kpis').innerHTML = `<p class="err">${esc(x.message)}</p>`;
    return;
  }
  STATS = d;
  const t = d.totals,
    p = d.prev,
    errs = t.err4 + t.err5,
    perr = p.err4 + p.err5;
  $('#kpis').innerHTML =
    [
      ['Requests', num(t.hits), delta(t.hits, p.hits), `${num(Math.round(t.hits / d.days))} per day`],
      ['Visitors', num(t.visitors), delta(t.visitors, p.visitors), 'unique per day, summed'],
      [
        'Error rate',
        pct(errs, t.hits),
        delta(t.hits ? errs / t.hits : 0, p.hits ? perr / p.hits : 0, -1),
        `${num(t.err4)} client (4xx), ${num(t.err5)} server (5xx)`,
      ],
      ['Avg response', `${num(t.avgMs)} ms`, delta(t.avgMs, p.avgMs || null, -1), 'time in the Worker'],
    ]
      .map(([k, v, dl, s]) => `<div class="kpi"><small>${k}</small><b>${v}</b>${dl}<span>${esc(s)}</span></div>`)
      .join('') + `<p class="muted small kpinote">Compared with the ${d.days} days before.</p>`;
  $('#chart').className = 'chart';
  $('#chart').innerHTML = t.hits ? chart(d.daily) : '<p class="empty">No traffic recorded yet. Counting started when analytics was deployed.</p>';
  const maxT = Math.max(1, ...d.tools.map((r) => r.hits));
  $('#tooltab tbody').innerHTML =
    `<tr><th scope="col">Tool</th><th scope="col" class="n">Requests</th><th scope="col"><span class="sr">Share</span></th><th scope="col" class="n">Visitors</th><th scope="col" class="n">Errors</th><th scope="col" class="n">Avg ms</th><th scope="col">Trend</th></tr>` +
    (!d.tools.length
      ? '<tr><td colspan="7" class="empty">No data yet.</td></tr>'
      : d.tools
          .map(
            (r) =>
              `<tr><th scope="row"><button type="button" class="linkish" data-tool="${esc(r.tool)}" aria-controls="tooldetail">${esc(r.tool)}</button></th><td class="n">${num(r.hits)}</td><td style="width:22%"><span class="tr brow" style="display:block;padding:0"><span class="tr" style="display:block"><i style="width:${(r.hits / maxT) * 100}%"></i></span></span></td><td class="n">${num(r.visitors)}</td><td class="n">${num(r.err4 + r.err5)}</td><td class="n">${num(r.avgMs)}</td><td>${spark(r.series)}</td></tr>`,
          )
          .join(''));
  collapse('#tooltab', '#tmore', 12, 'tools');
  $('#countries').innerHTML = bars(topN(d.countries, 5));
  $('#browsers').innerHTML = donut(d.browsers);
  $('#devices').innerHTML = donut(d.devices);
  $('#paths tbody').innerHTML =
    '<tr><th scope="col">Tool</th><th scope="col">Endpoint</th><th scope="col" class="n">Requests</th></tr>' +
    (d.paths.length
      ? d.paths.map((r) => `<tr><th scope="row">${esc(r.tool)}</th><td class="mono">${esc(r.path)}</td><td class="n">${num(r.n)}</td></tr>`).join('')
      : '<tr><td colspan="3" class="empty">No data yet.</td></tr>');
  collapse('#paths', '#pmore', 10, 'endpoints');
  $('#errtab tbody').innerHTML =
    '<tr><th scope="col">Tool</th><th scope="col">Endpoint</th><th scope="col" class="n">5xx</th><th scope="col" class="n">4xx</th><th scope="col" class="n">Error rate</th></tr>' +
    (d.errors.length
      ? d.errors
          .map(
            (r) =>
              `<tr><th scope="row">${esc(r.tool)}</th><td class="mono">${esc(r.path)}</td><td class="n${r.e5 ? ' bad' : ''}">${num(r.e5)}</td><td class="n">${num(r.e4)}</td><td class="n">${pct(r.e4 + r.e5, r.n)}</td></tr>`,
          )
          .join('')
      : '<tr><td colspan="5" class="empty">No errors recorded. 🎉</td></tr>');
  if (detailTool) loadToolDetail(detailTool);
  const top = [...USERS]
    .filter((u) => u.hits30 > 0)
    .sort((a, b) => b.hits30 - a.hits30)
    .slice(0, 8);
  $('#topusers').innerHTML = top.length
    ? bars(top.map((u) => ({ key: u.name ?? u.id, n: u.hits30 }))) +
      '<p class="muted" style="margin:8px 0 0;font-size:.82em">Requests to sign-in-only tools, last 30 days.</p>'
    : '<p class="empty">No signed-in activity yet.</p>';
}
async function loadToolDetail(tool) {
  detailTool = tool;
  const box = $('#tooldetail');
  box.hidden = false;
  box.innerHTML = '<p class="muted">Loading…</p>';
  let d;
  try {
    d = await api(`/api/stats?days=${days}&tool=${encodeURIComponent(tool)}`);
  } catch (x) {
    box.innerHTML = `<p class="err">${esc(x.message)}</p>`;
    return;
  }
  const hits = d.daily.reduce((a, r) => a + r.hits, 0),
    errs = d.daily.reduce((a, r) => a + r.errors, 0);
  const ms = hits ? Math.round(d.daily.reduce((a, r) => a + r.avgMs * r.hits, 0) / hits) : 0;
  box.innerHTML = `<div class="row"><h3 class="grow">${esc(tool)} <span class="muted small">last ${d.days} days · ${num(hits)} requests · ${pct(errs, hits)} errors · ${num(ms)} ms avg</span></h3>
    <a href="https://${esc(tool)}.${esc(location.hostname.split('.').slice(-2).join('.'))}" target="_blank" rel="noopener">Open tool</a><button type="button" id="tdclose">Close</button></div>
    <div class="chart">${hits ? chart(d.daily) : '<p class="empty">No requests in this period.</p>'}</div>
    ${d.paths.length ? `<div class="scroll"><table><caption class="sr">${esc(tool)} endpoints</caption><tbody><tr><th scope="col">Endpoint</th><th scope="col" class="n">Requests</th><th scope="col" class="n">4xx</th><th scope="col" class="n">5xx</th></tr>${d.paths.map((r) => `<tr><td class="mono">${esc(r.path)}</td><td class="n">${num(r.n)}</td><td class="n">${num(r.e4)}</td><td class="n${r.e5 ? ' bad' : ''}">${num(r.e5)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
  $('#tdclose').addEventListener('click', () => {
    detailTool = null;
    box.hidden = true;
    document.querySelector(`#tooltab [data-tool="${CSS.escape(tool)}"]`)?.focus();
  });
}
/** Long tables show their first `n` rows; a button reveals the rest. The header row (th scope=col) is never hidden. */
function collapse(table, btn, n, noun) {
  const rows = [...$(table).querySelectorAll('tbody tr')].filter((r) => !r.querySelector('th[scope=col]'));
  const b = $(btn),
    extra = rows.length - n;
  rows.forEach((r, i) => r.classList.toggle('more', i >= n));
  $(table).classList.remove('open');
  b.hidden = extra <= 0;
  b.textContent = `Show all ${num(rows.length)} ${noun}`;
  b.setAttribute('aria-expanded', 'false');
}
for (const [t, b] of [
  ['#tooltab', '#tmore'],
  ['#paths', '#pmore'],
])
  $(b).addEventListener('click', () => {
    const open = $(t).classList.toggle('open');
    $(b).setAttribute('aria-expanded', String(open));
    $(b).textContent = open ? 'Show fewer' : $(b).textContent.replace('Show fewer', '');
    if (!open) collapse(t, b, t === '#tooltab' ? 12 : 10, t === '#tooltab' ? 'tools' : 'endpoints');
  });
$('#tfilt').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  $('#tooltab').classList.toggle('filtering', !!q);
  for (const r of $('#tooltab').querySelectorAll('tbody tr')) if (!r.querySelector('th[scope=col]')) r.hidden = !!q && !r.textContent.toLowerCase().includes(q);
});
$('#tooltab').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tool]');
  if (b) {
    loadToolDetail(b.dataset.tool);
    $('#tooldetail').scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
});
// CSV of what's on screen: daily totals, then per-tool totals. Built client-side from the loaded data.
$('#csv').addEventListener('click', () => {
  if (!STATS) return;
  const q = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const lines = [
    ['day', 'requests', 'visitors', 'errors'],
    ...STATS.daily.map((r) => [r.day, r.hits, r.visitors, r.errors]),
    [],
    ['tool', 'requests', 'visitors', 'errors_4xx', 'errors_5xx', 'avg_ms'],
    ...STATS.tools.map((r) => [r.tool, r.hits, r.visitors, r.err4, r.err5, r.avgMs]),
  ];
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([lines.map((l) => l.map(q).join(',')).join('\n') + '\n'], { type: 'text/csv' })),
    download: `6o2f-analytics-${STATS.from}-to-${STATS.to}.csv`,
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('#range').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-d]');
  if (!btn) return;
  days = Number(btn.dataset.d);
  $('#range')
    .querySelectorAll('button')
    .forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  loadStats();
});

await loadUsers();
showTab(Object.keys(HASH).find((k) => HASH[k] === location.hash) ?? 'users');
