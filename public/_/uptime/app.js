import { $, api, esc, mountBar } from '/_/ui.js';
await mountBar('Uptime');
const ago = (t) => {
  const s = Math.max(0, ((Date.now() - t) / 1000) | 0);
  return s < 90 ? 'just now' : s < 5400 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`;
};
const isUp = (s) => s >= 200 && s < 400;
// One 4px bar per check (oldest left); bar height follows response time. Built from numbers only.
const spark = (recent) => {
  const max = Math.max(1, ...recent.map(([, ms]) => ms));
  return `<svg class="spark" viewBox="0 0 192 28" role="img" aria-label="Last ${recent.length} checks">${recent
    .map(([s, ms], i) => {
      const h = isUp(s) ? 6 + Math.round((22 * ms) / max) : 28;
      return `<rect class="${isUp(s) ? 'up' : 'down'}" x="${i * 4}" y="${28 - h}" width="3" height="${h}"/>`;
    })
    .join('')}</svg>`;
};
async function load() {
  const ms = await api('/api/monitors');
  $('#empty').hidden = ms.length > 0;
  $('#list').innerHTML = ms
    .map((m) => {
      const state = m.last_checked == null ? ['pending', ''] : isUp(m.last_status) ? ['up', 'up'] : ['down', 'down'];
      return `<div class="card mon" role="listitem"><span class="badge ${state[1]}" role="img" aria-label="Status: ${state[0]}">${state[0]}</span><div><b>${esc(m.name)}</b><br><span class="url">${esc(m.url)}</span></div><button type="button" class="danger" data-d="${esc(m.id)}" aria-label="Delete ${esc(m.name)}">Delete</button>
<div class="stats"><span>status ${m.last_checked == null ? '-' : m.last_status || 'no response'}</span>${m.last_checked == null ? '' : `<span>checked <time datetime="${new Date(m.last_checked).toISOString()}">${ago(m.last_checked)}</time></span>`}<span>${m.last_ms == null ? '-' : m.last_ms + ' ms'}</span><span>24 h: ${m.up24 == null ? '-' : m.up24 + '%'}</span>${m.recent.length ? spark(m.recent) : ''}</div></div>`;
    })
    .join('');
}
$('#f').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#msg').textContent = '';
  if (!$('#url').value.trim()) return;
  try {
    await api('/api/monitors', { method: 'POST', body: { name: $('#name').value, url: $('#url').value.trim() } });
    $('#name').value = '';
    await load();
  } catch (x) {
    $('#msg').textContent = x.message;
  }
});
$('#list').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-d]');
  if (!b) return;
  if (!b.dataset.sure) {
    // two-step delete, no confirm() dialog
    const al = b.getAttribute('aria-label');
    b.dataset.sure = '1';
    b.textContent = 'Confirm delete';
    b.removeAttribute('aria-label');
    $('#msg').textContent = '';
    setTimeout(() => {
      if (b.isConnected) {
        b.textContent = 'Delete';
        b.setAttribute('aria-label', al);
        delete b.dataset.sure;
      }
    }, 4000);
    return;
  }
  try {
    await api(`/api/monitors/${b.dataset.d}`, { method: 'DELETE' });
    await load();
    $('#name').focus();
  } catch (x) {
    $('#msg').textContent = x.message;
  }
});
load().catch((x) => ($('#msg').textContent = x.message));
// New checks land every 5 minutes: refresh while the tab is visible, but not mid-way through a two-step delete.
setInterval(() => {
  if (!document.hidden && !$('#list [data-sure]')) load().catch(() => {});
}, 60000);
