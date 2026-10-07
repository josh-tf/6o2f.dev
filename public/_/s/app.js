import { $, api, esc, mountBar } from '/_/ui.js';
await mountBar('Short links');
async function copyText(text, btn, label) {
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = 'Copied';
  } catch {
    const t = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(t);
    t.select();
    const ok = document.execCommand?.('copy');
    t.remove();
    btn.textContent = ok ? 'Copied' : 'Press Ctrl+C';
  }
  setTimeout(() => (btn.textContent = label), 1500);
}
async function load() {
  try {
    const links = await api('/api/links');
    $('#empty').hidden = links.length > 0;
    $('#list').innerHTML = links
      .map(
        (
          l,
        ) => `<tr><th scope="row" style="font-weight:400"><a href="${esc(l.short)}" rel="noopener noreferrer">${esc(l.short.replace(/^https:\/\//, ''))}</a><br><span class="dest">${esc(l.url)}</span></th>
<td class="muted">${l.exp ? `<time datetime="${new Date(l.exp).toISOString()}">${esc(new Date(l.exp).toLocaleDateString())}</time>` : 'never'}</td>
<td class="act"><button type="button" data-copy="${esc(l.short)}" aria-label="Copy ${esc(l.slug)}">Copy</button> <button type="button" class="danger" data-del="${esc(l.slug)}" aria-label="Delete ${esc(l.slug)}">Delete</button></td></tr>`,
      )
      .join('');
  } catch (x) {
    $('#msg').textContent = `Could not load your links: ${x.message}`;
  }
}
$('#f').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target,
    go = $('#go');
  $('#msg').textContent = '';
  go.disabled = true;
  try {
    const r = await api('/api/links', { method: 'POST', body: { url: f.url.value.trim(), slug: f.slug.value.trim(), ttl: f.ttl.value } });
    f.reset();
    $('#made').hidden = false;
    $('#made').innerHTML =
      `<span>Created:</span> <a href="${esc(r.short)}" rel="noopener noreferrer">${esc(r.short)}</a><button type="button" id="mc">Copy</button>`;
    copyText(r.short, $('#mc'), 'Copy');
    $('#mc').addEventListener('click', () => copyText(r.short, $('#mc'), 'Copy'));
    await load();
  } catch (x) {
    $('#msg').textContent = x.message;
  }
  go.disabled = false;
});
const armed = new Map();
$('#list').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const { copy, del } = b.dataset;
  if (copy) return copyText(copy, b, 'Copy');
  if (!del) return;
  if (!armed.has(del)) {
    b.textContent = 'Confirm?';
    armed.set(
      del,
      setTimeout(() => {
        armed.delete(del);
        b.textContent = 'Delete';
      }, 3000),
    );
    return;
  } // two-step instead of confirm()
  clearTimeout(armed.get(del));
  armed.delete(del);
  try {
    await api(`/api/links/${encodeURIComponent(del)}`, { method: 'DELETE' });
  } catch (x) {
    $('#msg').textContent = x.message;
  }
  load();
});
load();
