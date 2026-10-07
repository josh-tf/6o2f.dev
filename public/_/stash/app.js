import { $, api, esc, mountBar } from '/_/ui.js';
mountBar('Stash');
let keys = [],
  cur = null;
const KEY_RE = /^[A-Za-z0-9._:-]{1,100}$/;
const kb = (n) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);
const curl = (k) => `T=6o2f_yourtoken   # create one on the dashboard
curl -H "Authorization: Bearer $T" https://stash.6o2f.dev/api/kv                       # list keys
curl -H "Authorization: Bearer $T" https://stash.6o2f.dev/api/kv/${k}      # read
curl -X PUT --data-binary 'hello' -H "Authorization: Bearer $T" https://stash.6o2f.dev/api/kv/${k}   # write
curl -X DELETE -H "Authorization: Bearer $T" https://stash.6o2f.dev/api/kv/${k}   # delete`;
const sure = (on) => {
  $('#sure').hidden = !on;
  $('#del').hidden = on;
  if (on) $('#no').focus();
};
async function load() {
  try {
    keys = await api('/api/kv');
  } catch (x) {
    $('#kmsg').textContent = x.message;
    return;
  }
  if (!keys.length && cur === null) {
    await api('/api/kv/welcome', { method: 'PUT', body: 'Hello from stash. Edit me, or delete me.', headers: { 'content-type': 'text/plain' } });
    keys = await api('/api/kv');
  }
  $('#none').hidden = keys.length > 0;
  $('#keys').innerHTML = keys
    .map(
      (k) =>
        `<li><button type="button" data-k="${esc(k.key)}" aria-current="${k.key === cur}"><span class="k">${esc(k.key)}</span><small>${kb(k.size)}</small></button></li>`,
    )
    .join('');
}
async function open(k) {
  cur = k;
  sure(false);
  $('#msg').textContent = '';
  $('#ed').hidden = false;
  $('#kname').textContent = k;
  $('#curl').textContent = curl(k);
  $('#val').value = await api(`/api/kv/${encodeURIComponent(k)}`).catch((x) => {
    $('#msg').textContent = x.message;
    return '';
  });
  size();
  await load();
}
$('#keys').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) open(b.dataset.k);
});
$('#addf').addEventListener('submit', (e) => {
  e.preventDefault();
  const k = $('#nk').value.trim();
  $('#kmsg').textContent = '';
  if (!KEY_RE.test(k)) return ($('#kmsg').textContent = 'Use 1-100 of letters, digits . _ : -');
  if (keys.some((x) => x.key === k)) {
    $('#nk').value = '';
    return open(k);
  }
  $('#nk').value = '';
  cur = k;
  sure(false);
  $('#ed').hidden = false;
  $('#kname').textContent = k;
  $('#val').value = '';
  $('#msg').textContent = 'New key: save to create it.';
  $('#curl').textContent = curl(k);
  $('#val').focus();
  size();
});
$('#save').addEventListener('click', async () => {
  try {
    await api(`/api/kv/${encodeURIComponent(cur)}`, { method: 'PUT', body: $('#val').value, headers: { 'content-type': 'text/plain' } });
    $('#msg').textContent = 'Saved.';
    await load();
  } catch (x) {
    $('#msg').textContent = x.message;
  }
});
$('#del').addEventListener('click', () => sure(true));
$('#no').addEventListener('click', () => {
  sure(false);
  $('#del').focus();
});
$('#yes').addEventListener('click', async () => {
  try {
    await api(`/api/kv/${encodeURIComponent(cur)}`, { method: 'DELETE' });
  } catch (x) {
    sure(false);
    $('#msg').textContent = x.message;
    return;
  }
  cur = '';
  $('#ed').hidden = true;
  await load();
  $('#curl').textContent = curl('my-key');
  $('#nk').focus();
});
$('#curl').textContent = curl('my-key');
await load();
if (keys[0]) open(keys[0].key);
function size() {
  const n = new TextEncoder().encode($('#val').value).length;
  $('#sz').textContent = `${kb(n)} of 64 KB`;
  $('#sz').className = n > 65536 ? 'err small' : 'muted small';
}
$('#val').addEventListener('input', size);
$('#val').addEventListener('keydown', (e) => {
  if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    $('#save').click();
  }
});
