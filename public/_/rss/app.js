import { $, api, esc, mountBar } from '/_/ui.js';
mountBar('Feeds');
const SEEN = 'rss:seen:v1';
let seen = new Set(),
  items = [];
try {
  seen = new Set(JSON.parse(localStorage.getItem(SEEN) ?? '[]'));
} catch {}
const saveSeen = () => {
  try {
    localStorage.setItem(SEEN, JSON.stringify([...seen].slice(-3000)));
  } catch {}
};
const key = (i) => i.link || `${i.feed}:${i.title}`;
const when = (d) => {
  const t = new Date(d);
  return d && !isNaN(t) ? ` · <time datetime="${t.toISOString()}">${esc(t.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }))}</time>` : '';
};
const msg = (t) => ($('#msg').textContent = t);

async function feeds() {
  const rows = await api('/api/feeds');
  $('#feeds').innerHTML = rows
    .map(
      (f) =>
        `<li><span title="${esc(f.url)}">${esc(f.title || f.url)}</span><button type="button" data-del="${esc(f.id)}" aria-label="Remove ${esc(f.title || f.url)}">✕</button></li>`,
    )
    .join('');
  return rows.length;
}
function draw() {
  const unread = items.filter((i) => !seen.has(key(i))).length;
  $('#count').textContent = items.length ? `${unread} unread of ${items.length}` : '';
  const fn = document.activeElement?.dataset?.n;
  $('#items').innerHTML = items
    .map(
      (
        i,
        n,
      ) => `<li class="${seen.has(key(i)) ? 'read' : ''}"><a href="${esc(i.link ?? '')}" target="_blank" rel="noopener noreferrer" data-n="${n}"${i.link ? '' : ' hidden'}>${esc(i.title)}</a>${i.link ? '' : `<b>${esc(i.title)}</b>`}
    <div class="meta">${esc(i.source)}${when(i.date)}</div>${i.snippet ? `<p>${esc(i.snippet)}</p>` : ''}</li>`,
    )
    .join('');
  $('#items').hidden = !items.length;
  if (fn != null) $(`#items a[data-n="${fn}"]`)?.focus();
}
async function load() {
  $('#refresh').disabled = true;
  $('#empty').hidden = false;
  $('#empty').textContent = 'Loading…';
  try {
    const n = await feeds();
    if (!n) {
      items = [];
      $('#errs').textContent = '';
      $('#empty').innerHTML =
        'No feeds yet. Add one above, or try: <button type="button" data-try="https://blog.cloudflare.com/rss/">Cloudflare blog</button> <button type="button" data-try="https://hnrss.org/frontpage">Hacker News</button>';
      return draw();
    }
    const r = await api('/api/items');
    items = r.items;
    draw();
    $('#errs').innerHTML = r.errors.map((e) => `${esc(e.url)}: ${esc(e.error)}`).join('<br>');
    $('#empty').hidden = items.length > 0;
    $('#empty').textContent = 'No items found in your feeds.';
  } catch (x) {
    $('#empty').textContent = x.message;
  } finally {
    $('#refresh').disabled = false;
  }
}
$('#add').addEventListener('submit', async (e) => {
  e.preventDefault();
  msg('');
  const b = e.submitter ?? $('#add button[type=submit]');
  b.disabled = true;
  b.textContent = 'Checking…';
  try {
    await api('/api/feeds', { method: 'POST', body: { url: $('#url').value } });
    $('#url').value = '';
    await load();
  } catch (x) {
    msg(x.message);
  }
  b.disabled = false;
  b.textContent = 'Add feed';
});
$('#feeds').addEventListener('click', async (e) => {
  const id = e.target.closest('button')?.dataset.del;
  if (!id) return;
  try {
    await api(`/api/feeds/${id}`, { method: 'DELETE' });
    await load();
    $('#url').focus();
  } catch (x) {
    msg(x.message);
  }
});
$('#empty').addEventListener('click', (e) => {
  const u = e.target.dataset.try;
  if (u) {
    $('#url').value = u;
    $('#add').requestSubmit();
  }
});
$('#items').addEventListener('click', (e) => {
  const a = e.target.closest('a[data-n]');
  if (a) {
    seen.add(key(items[a.dataset.n]));
    saveSeen();
    draw();
  }
});
$('#seen').addEventListener('click', () => {
  items.forEach((i) => seen.add(key(i)));
  saveSeen();
  draw();
});
$('#refresh').addEventListener('click', load);
load();
