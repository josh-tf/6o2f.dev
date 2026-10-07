import { $, api, esc, mountBar } from '/_/ui.js';
mountBar('Clipboard');
$('#dashlink').href = `https://${location.hostname.split('.').slice(-2).join('.')}/`;
const ago = (t) => {
  const s = Math.max(0, ((t - Date.now()) / 1000) | 0);
  return s >= 3600 ? `${Math.round(s / 3600)} h` : s >= 60 ? `${Math.round(s / 60)} min` : `${s} s`;
};
const note = (t) => ($('#note').textContent = t);
let html = '';
async function list() {
  let rows;
  try {
    rows = await api('/api/clips');
  } catch (x) {
    note(`Could not refresh: ${x.message}`);
    return;
  }
  note('Refreshes every 5 seconds.');
  $('#empty').hidden = rows.length > 0;
  const next = rows
    .map(
      (c) =>
        `<li><span class="p mono" title="${esc(c.preview)}">${esc(c.preview)}</span><small>expires in ${ago(c.expires)}</small><button type="button" data-copy="${esc(c.id)}">Copy</button><button type="button" class="danger" data-del="${esc(c.id)}" aria-label="Delete clip: ${esc(c.preview.slice(0, 30))}">Delete</button></li>`,
    )
    .join('');
  if (next === html) return; // keep focus and button labels stable between polls
  html = next;
  const a = document.activeElement,
    sel = a?.dataset?.copy ? `[data-copy="${a.dataset.copy}"]` : a?.dataset?.del ? `[data-del="${a.dataset.del}"]` : '';
  $('#list').innerHTML = next;
  if (sel) ($(sel) ?? $('#text')).focus();
}
async function send() {
  const text = $('#text').value;
  $('#msg').textContent = '';
  if (!text.trim()) {
    $('#msg').textContent = 'Type or paste some text first.';
    return;
  }
  try {
    await api('/api/clips', { method: 'POST', body: { text, ttl: $('#ttl').value } });
    $('#text').value = '';
    $('#text').focus();
    await list();
  } catch (x) {
    $('#msg').textContent = x.message;
  }
}
$('#new').addEventListener('submit', (e) => {
  e.preventDefault();
  send();
});
$('#text').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    send();
  }
});
$('#list').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.del) {
    try {
      await api(`/api/clips/${b.dataset.del}`, { method: 'DELETE' });
      await list();
    } catch (x) {
      note(x.message);
    }
  } else if (b.dataset.copy) {
    const id = b.dataset.copy;
    try {
      await navigator.clipboard.writeText(await api(`/api/clips/${id}`));
      b.textContent = 'Copied';
      note('Copied to clipboard.');
    } catch {
      b.textContent = 'Failed';
      note('Could not copy. Clipboard access was blocked or the clip expired.');
    }
    setTimeout(() => {
      b.textContent = 'Copy';
    }, 1500);
  }
});
list();
setInterval(() => !document.hidden && list(), 5000);
