import { $, esc, mountBar } from '/_/ui.js';
import { LANGS, escape, unescape } from './lib.js';
mountBar('Escape');

let msgT;
async function copy(text, what) {
  const msg = $('#msg');
  try {
    await navigator.clipboard.writeText(text);
    msg.textContent = `Copied ${what}`;
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.append(t);
    t.select();
    const ok = document.execCommand?.('copy');
    t.remove();
    msg.textContent = ok ? `Copied ${what}` : 'Copy blocked by the browser. Select the text and press Ctrl+C.';
  }
  clearTimeout(msgT);
  msgT = setTimeout(() => (msg.textContent = ''), 2500);
}

const outs = new Map();
function escAll() {
  const s = $('#in').value,
    ascii = $('#ascii').checked;
  $('#count').textContent = `${[...s].length} characters`;
  $('#all tbody').innerHTML = LANGS.map(([id, name]) => {
    let v,
      note = '';
    try {
      v = escape(id, s, { ascii });
      outs.set(id, v);
    } catch (e) {
      outs.delete(id);
      return `<tr><th scope="row">${esc(name)}</th><td class="v"><span class="bad">${esc(e.message)}</span></td><td></td></tr>`;
    }
    if (id === 'shdouble' && s.includes('!')) note = 'Interactive bash expands ! inside double quotes: prefer single quotes.';
    if ((id === 'sql' || id === 'csv') && !s) note = '(empty)';
    return `<tr><th scope="row">${esc(name)}</th><td class="v"><pre>${esc(v)}</pre>${note ? `<span class="note">${esc(note)}</span>` : ''}</td><td><button type="button" data-l="${id}" aria-label="Copy ${esc(name)}">Copy</button></td></tr>`;
  }).join('');
}
$('#all').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-l]');
  if (b) copy(outs.get(b.dataset.l) ?? '', b.getAttribute('aria-label').replace('Copy ', ''));
});

$('#lang').innerHTML = LANGS.map(([id, name]) => `<option value="${id}">${esc(name)}</option>`).join('');
function unAll() {
  $('#uerr').textContent = '';
  $('#uwarn').innerHTML = '';
  $('#un').removeAttribute('aria-invalid');
  try {
    const r = unescape($('#lang').value, $('#un').value);
    $('#uout').textContent = r.text;
    $('#uwarn').innerHTML = r.warnings.map((w) => `<li>${esc(w)}</li>`).join('');
  } catch (e) {
    $('#uout').textContent = '';
    $('#uerr').textContent = e.message;
    $('#un').setAttribute('aria-invalid', 'true');
  }
}
$('#ucopy').addEventListener('click', () => copy($('#uout').textContent, 'result'));

$('#in').value = 'She said "it\'s done" \\o/\nPath:\tC:\\new\\temp — 50% off ✓ 😀';
$('#un').value = String.raw`'Café \u{1F375}\n\tIt\'s \x41 ✓'`;
$('#lang').value = 'js';
$('#in').addEventListener('input', escAll);
$('#ascii').addEventListener('change', escAll);
$('#un').addEventListener('input', unAll);
$('#lang').addEventListener('change', unAll);
escAll();
unAll();
