import { $, api, esc, mountBar } from '/_/ui.js';
await mountBar('HTTP');
const KEY = 'http.history',
  SECRET = /^(authorization|x-api-key|proxy-authorization)$/i;
$('#method').innerHTML = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => `<option>${m}</option>`).join('');
const load = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
};
const save = (h) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(h));
  } catch {}
};

function addRow(name = '', value = '') {
  const r = document.createElement('div');
  r.className = 'hrow';
  r.innerHTML = `<input aria-label="Header name" placeholder="Name" autocomplete="off" spellcheck="false" autocapitalize="off" value="${esc(name)}"><input aria-label="Header value" placeholder="Value" autocomplete="off" spellcheck="false" autocapitalize="off" value="${esc(value)}"><button type="button" aria-label="Remove header">&times;</button>`;
  r.lastChild.onclick = () => r.remove();
  $('#hdrs').append(r);
}
const rows = () => [...$('#hdrs').children].map((r) => ({ name: r.children[0].value, value: r.children[1].value }));
$('#addh').onclick = () => addRow();

function fill(h) {
  $('#method').value = h.method;
  $('#url').value = h.url;
  $('#body').value = h.body ?? '';
  $('#hdrs').replaceChildren();
  h.headers.forEach((x) => addRow(x.name, x.value));
}
function drawHist() {
  const h = load();
  $('#none').hidden = h.length > 0;
  $('#clear').hidden = !h.length;
  $('#hist').innerHTML = h
    .map(
      (x, i) =>
        `<li><b>${esc(x.method)}</b><button type="button" data-i="${i}" title="Load this request">${esc(x.url)}</button><span class="muted">${esc(x.status)}</span></li>`,
    )
    .join('');
}
$('#hist').onclick = (e) => {
  const i = e.target.dataset?.i;
  if (i != null) fill(load()[i]);
};
$('#clear').onclick = () => {
  save([]);
  drawHist();
};

$('#f').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#msg').textContent = '';
  $('#send').disabled = true;
  const req = { method: $('#method').value, url: $('#url').value.trim(), headers: rows().filter((r) => r.name || r.value), body: $('#body').value };
  let status = 'error';
  try {
    const r = await api('/api/send', { method: 'POST', body: req });
    status = r.status;
    $('#res').hidden = false;
    $('#status').textContent = `${r.status} ${r.statusText}`;
    $('#status').className = r.status < 400 ? '' : 'err';
    $('#meta').textContent = `${r.ms} ms · ${r.size} bytes${r.truncated ? ' (truncated at 512 KB)' : ''}`;
    $('#chain').textContent = r.chain.length > 1 ? 'Redirects: ' + r.chain.map((c) => `${c.status} ${c.url}`).join(' → ') : '';
    $('#rh').innerHTML = r.headers.map(([k, v]) => `<tr><th scope="row" class="k">${esc(k)}</th><td class="v">${esc(v)}</td></tr>`).join('');
    $('#rb').textContent = r.body || '(empty body)';
  } catch (x) {
    $('#msg').textContent = x.message;
  }
  $('#send').disabled = false;
  // Secret headers are not kept; request bodies are kept only when no secret header is present.
  const hasSecret = req.headers.some((h) => SECRET.test(h.name));
  const entry = { ...req, status, headers: req.headers.filter((h) => !SECRET.test(h.name)), body: hasSecret ? '' : req.body };
  save([entry, ...load().filter((x) => x.method !== entry.method || x.url !== entry.url)].slice(0, 10));
  drawHist();
});
addRow('Accept', 'application/json');
addRow('X-Demo', 'hello');
drawHist();
