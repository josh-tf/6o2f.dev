import { $, api, esc, mountBar } from '/_/ui.js';
import { ago, bars, num, pct, spark, topN, when } from '/_/admin/charts.js';
// The Bots and Maze tabs moved to their own tool: send old links there.
if (/^#(bots|maze)$/.test(location.hash)) location.replace(`https://${location.hostname.replace(/^admin\./, 'labyrinth.')}/`);
const meUser = await mountBar('Admin');
$('#labyrinth-link').href = `https://${location.hostname.replace(/^admin\./, 'labyrinth.')}/`;

/* ---------- tabs ---------- */
const HASH = { users: '#users', content: '#content', controls: '#controls', stats: '#analytics', log: '#log' };
const LOAD = {
  content: () => loadContent(),
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
/** Top n items, the rest folded into one "Other" (merged with an existing "Other"/"other" item). */
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
