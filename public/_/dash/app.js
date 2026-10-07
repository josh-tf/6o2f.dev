import { $, api, esc, mountBar } from '/_/ui.js';
const [me, tools] = await Promise.all([mountBar(''), api('/api/tools')]); // in parallel, not one after the other
if (me?.noAccess) $('#noaccess').hidden = false;
const I = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const T = tools.map((t) => ({ ...t, icon: I(t.icon), title: t.title, desc: t.blurb, host: new URL(t.url).host }));

// Clock beside unpinned tools you've opened: they sit near the top because of use, not a pin.
const RECENT =
  '<span class="rc" title="Recently used"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span class="sr">, recently used</span></span>';
const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const LS = {
  get: (k, d) => {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? d;
    } catch {
      return d;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
};
const open = (t) => {
  const u = LS.get('6o2f-usage', {});
  u[t.name] = { n: (u[t.name]?.n ?? 0) + 1, t: Date.now() };
  LS.set('6o2f-usage', u);
  location.href = t.url;
};
/** Subsequence match: {score, idx} (lower score = better) or null. A plain substring beats a scattered match. */
function fuzzy(q, text) {
  const s = text.toLowerCase(),
    idx = [];
  let i = 0;
  for (let j = 0; j < s.length && i < q.length; j++)
    if (s[j] === q[i]) {
      idx.push(j);
      i++;
    }
  if (i < q.length) return null;
  const sub = s.indexOf(q);
  return sub >= 0 ? { score: sub - 100, idx: [...Array(q.length).keys()].map((k) => sub + k) } : { score: idx[idx.length - 1], idx };
}
const hl = (text, idx) => {
  const set = new Set(idx);
  return [...text].map((c, i) => (set.has(i) ? `<mark>${esc(c)}</mark>` : esc(c))).join('');
};

// ---- Finder: fuzzy filter, pins, most-used first, slide-out details panel ----
let q = '',
  sel = 0,
  panel = LS.get('6o2f-panel', false);
const usage = LS.get('6o2f-usage', {}),
  pins = new Set(LS.get('6o2f-pins', []));
const rank = (t) => (pins.has(t.name) ? -1e12 : 0) - (usage[t.name]?.n ?? 0) * 1e6 - (usage[t.name]?.t ?? 0) / 1e6;
const list = () =>
  q
    ? T.map((t) => {
        const a = fuzzy(q, t.title),
          m = a ?? fuzzy(q, `${t.name} ${t.desc}`);
        return m && { t, idx: a ? a.idx : [], score: m.score };
      })
        .filter(Boolean)
        .sort((a, b) => a.score - b.score)
    : [...T].sort((a, b) => rank(a) - rank(b) || T.indexOf(b) - T.indexOf(a)).map((t) => ({ t, idx: [] })); // ties: newest first (the registry is in build order)

function draw() {
  const l = list();
  sel = Math.min(sel, Math.max(0, l.length - 1));
  $('#fr').innerHTML =
    l
      .map(({ t, idx }, i) => {
        const pin = pins.has(t.name);
        return `<div class="r${i === sel ? ' on' : ''}" role="listitem" data-i="${i}"><button type="button" class="star" data-pin="${esc(t.name)}" aria-label="${pin ? 'Unpin' : 'Pin'} ${esc(t.title)}" aria-pressed="${pin}">${pin ? '★' : '☆'}</button><a class="rw" href="${esc(t.url)}" tabindex="-1"${i === sel ? ' aria-current="true"' : ''}>${t.icon}<b>${hl(t.title, idx)}${!pin && usage[t.name]?.n ? RECENT : ''}</b><span class="ds">${esc(t.desc)}</span><u>${esc(t.host)}</u>${t.locked ? `<span class="lk" title="Sign in required">${LOCK}<span class="sr">Sign in required</span></span>` : '<span class="lk"></span>'}</a></div>`;
      })
      .join('') || '<div class="r d" role="listitem">no matches</div>';
  $('#fc').textContent = `${l.length}/${T.length}`;
  $('#fc').setAttribute('aria-label', `${l.length} of ${T.length} tools`);
  const t = l[sel]?.t;
  $('#pv .pin').innerHTML = t
    ? `<div class="bi">${t.icon}</div><h2>${esc(t.title)}</h2><span class="d">${esc(t.desc)}</span><dl class="kv"><dt>url</dt><dd class="a">${esc(t.url)}</dd><dt>auth</dt><dd class="${t.locked ? 'lkd' : 'a'}">${t.locked ? `${LOCK} locked · sign in required` : 'public · no sign-in needed'}</dd><dt>notes</dt><dd>${esc(t.note)}</dd><dt>opened</dt><dd>${usage[t.name]?.n ?? 0}×</dd></dl><a class="go" href="${esc(t.url)}">open ⏎</a>`
    : '';
  $('#fr').querySelector('.r.on')?.scrollIntoView({ block: 'nearest' });
}
function setPanel(on) {
  panel = on;
  LS.set('6o2f-panel', on);
  $('#fb').dataset.open = on;
  $('#pv').inert = !on;
  $('#tg').setAttribute('aria-expanded', String(on));
  $('#tg').textContent = on ? '← hide details' : '→ details';
}
const togglePin = (name) => {
  pins.has(name) ? pins.delete(name) : pins.add(name);
  LS.set('6o2f-pins', [...pins]);
  draw();
};

$('#fq').addEventListener('input', (e) => {
  q = e.target.value.trim().toLowerCase();
  sel = 0;
  draw();
});
// Mouse only: a touch tap fires emulated mouseover, and redrawing on it makes iOS swallow the tap as a "hover".
$('#fr').addEventListener('pointerover', (e) => {
  if (e.pointerType !== 'mouse') return;
  const r = e.target.closest('[data-i]');
  if (r && +r.dataset.i !== sel) {
    sel = +r.dataset.i;
    draw();
  }
});
$('#fr').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pin]');
  if (b) return togglePin(b.dataset.pin);
  const r = e.target.closest('[data-i]');
  if (r && e.target.closest('a.rw')) {
    e.preventDefault();
    const it = list()[+r.dataset.i];
    if (it) open(it.t);
  }
});
$('#tg').addEventListener('click', () => setPanel(!panel));
// Random tool the viewer can actually open: never admin, and no locked tools for visitors (they'd hit a sign-in wall).
$('#lucky').addEventListener('click', () => {
  const pool = T.filter((t) => t.name !== 'admin' && (me || !t.locked));
  if (pool.length) open(pool[Math.floor(Math.random() * pool.length)]);
});
$('#pvx').addEventListener('click', () => {
  setPanel(false);
  $('#fq').focus();
});
addEventListener('keydown', (e) => {
  if (e.target.closest('details, form') || (e.target.tagName === 'INPUT' && e.target.id !== 'fq')) return;
  if (e.target.tagName === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return; // let buttons (pin, details) activate
  const l = list(),
    f = $('#fq');
  if (e.key === 'ArrowDown') {
    sel = Math.min(l.length - 1, sel + 1);
    draw();
    e.preventDefault();
  } else if (e.key === 'ArrowUp') {
    sel = Math.max(0, sel - 1);
    draw();
    e.preventDefault();
  } else if (e.key === 'Enter' && l[sel]) open(l[sel].t);
  else if (e.key === 'ArrowRight' && !panel && f.selectionStart === f.value.length) {
    setPanel(true);
    e.preventDefault();
  } else if (e.key === 'ArrowLeft' && panel && f.selectionStart === 0) {
    setPanel(false);
    e.preventDefault();
  } else if (e.key === 'p' && e.altKey && l[sel]) {
    togglePin(l[sel].t.name);
    e.preventDefault();
  } else if (e.key === 'Escape') {
    if (!q && panel) setPanel(false);
    else {
      f.value = '';
      q = '';
      sel = 0;
      draw();
    }
  } else if (e.key === '/' && document.activeElement !== f) {
    e.preventDefault();
    f.focus();
  }
});
setPanel(panel);
draw();
$('#fq').focus();

if (!me) $('details.settings').hidden = true;
else {
  const fmt = (ms) => (ms ? new Date(ms).toLocaleString() : 'never');
  const terr = (m) => ($('#terr').textContent = m);
  async function tokens() {
    let rows;
    try {
      rows = await api('/api/tokens');
    } catch (x) {
      return terr(x.message);
    }
    $('#tokens').innerHTML = rows
      .map(
        (t) =>
          `<tr><th scope="row">${esc(t.name)}</th><td class="muted">${t.last_used_at ? `<time datetime="${new Date(t.last_used_at).toISOString()}">${esc(fmt(t.last_used_at))}</time>` : 'never'}</td><td><button type="button" class="danger" data-t="${esc(t.id)}" aria-label="Revoke ${esc(t.name)}">Revoke</button></td></tr>`,
      )
      .join('');
    $('#tokens').closest('table').hidden = !rows.length;
    $('#notok').hidden = rows.length > 0;
  }
  $('#newtoken').addEventListener('submit', async (e) => {
    e.preventDefault();
    terr('');
    try {
      const r = await api('/api/tokens', { method: 'POST', body: { name: e.target.name.value.trim() } });
      $('#shown').textContent = r.token;
      $('#shown').title = 'Copy it now: it is shown only once';
      $('#shownbox').hidden = false;
      $('#copytok').textContent = 'Copy (shown once)';
      e.target.reset();
      tokens();
    } catch (x) {
      terr(x.message);
    }
  });
  $('#copytok').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('#shown').textContent);
      $('#copytok').textContent = 'Copied';
    } catch {
      getSelection().selectAllChildren($('#shown'));
      $('#copytok').textContent = 'Press Ctrl+C';
    }
  });
  $('#tokens').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-t]');
    if (!b) return;
    if (!b.dataset.sure) {
      b.dataset.sure = '1';
      b.textContent = 'Click again to revoke';
      setTimeout(() => {
        if (b.isConnected) {
          b.textContent = 'Revoke';
          delete b.dataset.sure;
        }
      }, 3000);
      return;
    }
    terr('');
    try {
      await api(`/api/tokens/${b.dataset.t}`, { method: 'DELETE' });
    } catch (x) {
      terr(x.message);
    }
    tokens();
  });
  tokens();
}
