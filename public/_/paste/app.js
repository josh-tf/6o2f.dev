import { $, api, esc, mountBar } from '/_/ui.js';
await mountBar('Pastebin');
const MAX = 512 * 1024; // server limit, bytes
const kb = (n) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);
const bytes = (s) => new TextEncoder().encode(s).length;
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
async function list() {
  try {
    const rows = await api('/api/pastes');
    $('#empty').hidden = rows.length > 0;
    $('#list').innerHTML = rows
      .map(
        (p) =>
          `<tr><th scope="row"><a href="/${esc(p.id)}" rel="noopener noreferrer">${esc(p.id)}</a></th><td class="mono pv" title="${esc(p.preview)}">${esc(p.preview.replace(/\s+/g, ' '))}</td><td class="muted">${kb(p.size)}</td><td class="muted"><time datetime="${new Date(p.expires).toISOString()}">${esc(new Date(p.expires).toLocaleString())}</time></td><td class="act"><button type="button" data-c="${esc(p.id)}" aria-label="Copy link to ${esc(p.id)}">Copy link</button> <button type="button" class="danger" data-d="${esc(p.id)}" aria-label="Delete ${esc(p.id)}">Delete</button></td></tr>`,
      )
      .join('');
  } catch (x) {
    $('#msg').textContent = `Could not load your pastes: ${x.message}`;
  }
}
function sizeHint() {
  const n = bytes($('#text').value);
  $('#size').textContent = n ? `${kb(n)} of ${kb(MAX)}` : '';
  $('#size').className = n > MAX ? 'err' : 'muted';
}
$('#text').addEventListener('input', sizeHint);
$('#new').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#msg').textContent = '';
  const text = $('#text').value;
  if (!text.trim()) {
    $('#msg').textContent = 'Nothing to paste: the text is empty.';
    return;
  }
  if (bytes(text) > MAX) {
    $('#msg').textContent = `Too large: ${kb(bytes(text))}, the limit is ${kb(MAX)}.`;
    return;
  }
  $('#create').disabled = true;
  try {
    const url = (await api(`/?ttl=${$('#ttl').value}`, { method: 'POST', body: text, headers: { 'content-type': 'text/plain' } })).trim();
    $('#link').href = $('#link').textContent = url;
    $('#made').hidden = false;
    $('#text').value = '';
    sizeHint();
    list();
  } catch (x) {
    $('#msg').textContent = x.message;
  }
  $('#create').disabled = false;
});
$('#copy').addEventListener('click', () => copyText($('#link').href, $('#copy'), 'Copy link'));
const armed = new Map();
$('#list').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.c) return copyText(`${location.origin}/${b.dataset.c}`, b, 'Copy link');
  const id = b.dataset.d;
  if (!id) return;
  if (!armed.has(id)) {
    // two-step delete instead of confirm()
    b.textContent = 'Confirm?';
    armed.set(
      id,
      setTimeout(() => {
        armed.delete(id);
        b.textContent = 'Delete';
      }, 3000),
    );
    return;
  }
  clearTimeout(armed.get(id));
  armed.delete(id);
  try {
    await api(`/${id}`, { method: 'DELETE' });
  } catch (x) {
    $('#msg').textContent = x.message;
  }
  list();
});
list();
